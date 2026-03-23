import json
import logging
import os
import time

import pika
import requests
from django.core.management.base import BaseCommand
from django.db import transaction

from app.models import InventoryItem, InventoryReservation, ProcessedEvent, ReservationStatus

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "bookstore.topic"
QUEUE_NAME = "inventory_service_queue"
BINDING_KEYS = [
    "inventory.reserve.requested",
    "inventory.commit.requested",
    "inventory.release.requested",
]
BOOK_SERVICE_URL = os.environ.get("BOOK_SERVICE_URL", "http://book-service:8000")


def _fetch_book_snapshot(book_id):
    try:
        response = requests.get(f"{BOOK_SERVICE_URL}/books/{book_id}/", timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.warning("inventory_book_lookup_failed book_id=%s error=%s", book_id, exc)
        return None


def _ensure_inventory_item(book_id):
    item = InventoryItem.objects.filter(book_id=book_id).first()
    if item:
        return item

    book = _fetch_book_snapshot(book_id)
    if not isinstance(book, dict):
        return None

    stock = book.get("stock", 0)
    try:
        stock = int(stock)
    except (TypeError, ValueError):
        stock = 0

    item, _ = InventoryItem.objects.get_or_create(
        book_id=book_id,
        defaults={"available_qty": max(stock, 0), "reserved_qty": 0},
    )
    return item


def _normalize_items(items):
    normalized = []
    for item in items or []:
        try:
            book_id = int(item.get("book_id"))
            quantity = int(item.get("quantity"))
        except (AttributeError, TypeError, ValueError):
            return None
        if quantity <= 0:
            return None
        normalized.append({"book_id": book_id, "quantity": quantity})
    return normalized or None


def _publish_completion(event_type, order_id, customer_id, success, message, correlation_id, saga_id, extra_payload=None):
    from app.events import publish_event

    payload = {
        "order_id": order_id,
        "customer_id": customer_id,
        "success": success,
        "message": message,
    }
    if extra_payload:
        payload.update(extra_payload)
    published, _ = publish_event(event_type, payload, correlation_id=correlation_id, saga_id=saga_id)
    if not published:
        raise RuntimeError(f"Failed to publish {event_type}")


def _handle_inventory_reserve(order_id, customer_id, saga_id, correlation_id, items, payload):
    normalized_items = _normalize_items(items)
    extra_payload = {
        "items": items or [],
        "force_payment_failure": payload.get("force_payment_failure", False),
        "force_shipping_failure": payload.get("force_shipping_failure", False),
    }
    if normalized_items is None:
        _publish_completion("inventory.reserve.completed", order_id, customer_id, False, "Invalid inventory items", correlation_id, saga_id, extra_payload)
        return

    extra_payload["items"] = normalized_items
    for item in normalized_items:
        if _ensure_inventory_item(item["book_id"]) is None:
            _publish_completion("inventory.reserve.completed", order_id, customer_id, False, f"Book {item['book_id']} not found for inventory bootstrap", correlation_id, saga_id, extra_payload)
            return

    with transaction.atomic():
        existing_reservations = {
            reservation.book_id: reservation
            for reservation in InventoryReservation.objects.select_for_update().filter(
                saga_id=saga_id,
                book_id__in=[item["book_id"] for item in normalized_items],
            )
        }

        if existing_reservations and len(existing_reservations) == len(normalized_items):
            if all(
                existing_reservations[item["book_id"]].status in (ReservationStatus.RESERVED, ReservationStatus.COMMITTED)
                and existing_reservations[item["book_id"]].quantity == item["quantity"]
                for item in normalized_items
            ):
                _publish_completion("inventory.reserve.completed", order_id, customer_id, True, "Inventory reservation already exists", correlation_id, saga_id, extra_payload)
                return

        locked_items = {}
        for item in normalized_items:
            inventory_item = InventoryItem.objects.select_for_update().get(book_id=item["book_id"])
            if inventory_item.available_qty < item["quantity"]:
                _publish_completion("inventory.reserve.completed", order_id, customer_id, False, f"Not enough stock for book {item['book_id']}", correlation_id, saga_id, extra_payload)
                return
            locked_items[item["book_id"]] = inventory_item

        for item in normalized_items:
            reservation = existing_reservations.get(item["book_id"])
            if reservation and reservation.status in (ReservationStatus.RESERVED, ReservationStatus.COMMITTED):
                continue
            inventory_item = locked_items[item["book_id"]]
            inventory_item.available_qty -= item["quantity"]
            inventory_item.reserved_qty += item["quantity"]
            inventory_item.save(update_fields=["available_qty", "reserved_qty"])
            InventoryReservation.objects.update_or_create(
                saga_id=saga_id,
                book_id=item["book_id"],
                defaults={"order_id": order_id, "quantity": item["quantity"], "status": ReservationStatus.RESERVED},
            )

        _publish_completion("inventory.reserve.completed", order_id, customer_id, True, "", correlation_id, saga_id, extra_payload)


def _handle_inventory_commit(order_id, customer_id, saga_id, correlation_id):
    with transaction.atomic():
        reservations = list(InventoryReservation.objects.select_for_update().filter(saga_id=saga_id))
        if not reservations:
            _publish_completion("inventory.commit.completed", order_id, customer_id, False, "No inventory reservations found", correlation_id, saga_id)
            return

        if all(reservation.status == ReservationStatus.COMMITTED for reservation in reservations):
            _publish_completion("inventory.commit.completed", order_id, customer_id, True, "Inventory already committed", correlation_id, saga_id)
            return

        if any(reservation.status == ReservationStatus.RELEASED for reservation in reservations):
            _publish_completion("inventory.commit.completed", order_id, customer_id, False, "Cannot commit released reservations", correlation_id, saga_id)
            return

        inventory_items = {item.book_id: item for item in InventoryItem.objects.select_for_update().filter(book_id__in=[reservation.book_id for reservation in reservations])}

        for reservation in reservations:
            if reservation.status != ReservationStatus.RESERVED:
                continue
            item = inventory_items[reservation.book_id]
            item.reserved_qty -= reservation.quantity
            item.save(update_fields=["reserved_qty"])
            reservation.status = ReservationStatus.COMMITTED
            reservation.save(update_fields=["status"])

        _publish_completion("inventory.commit.completed", order_id, customer_id, True, "", correlation_id, saga_id)


def _handle_inventory_release(order_id, customer_id, saga_id, correlation_id):
    with transaction.atomic():
        reservations = list(InventoryReservation.objects.select_for_update().filter(saga_id=saga_id))
        if not reservations:
            _publish_completion("inventory.release.completed", order_id, customer_id, True, "No inventory reservations to release", correlation_id, saga_id)
            return

        if all(reservation.status == ReservationStatus.RELEASED for reservation in reservations):
            _publish_completion("inventory.release.completed", order_id, customer_id, True, "Inventory already released", correlation_id, saga_id)
            return

        if any(reservation.status == ReservationStatus.COMMITTED for reservation in reservations):
            _publish_completion("inventory.release.completed", order_id, customer_id, False, "Cannot release committed reservations", correlation_id, saga_id)
            return

        inventory_items = {item.book_id: item for item in InventoryItem.objects.select_for_update().filter(book_id__in=[reservation.book_id for reservation in reservations])}

        for reservation in reservations:
            if reservation.status != ReservationStatus.RESERVED:
                continue
            item = inventory_items[reservation.book_id]
            item.available_qty += reservation.quantity
            item.reserved_qty -= reservation.quantity
            item.save(update_fields=["available_qty", "reserved_qty"])
            reservation.status = ReservationStatus.RELEASED
            reservation.save(update_fields=["status"])

        _publish_completion("inventory.release.completed", order_id, customer_id, True, "", correlation_id, saga_id)


def _process_message(ch, method, properties, body):
    data = {}
    try:
        data = json.loads(body)
        event_type = data.get("event_type")
        event_id = data.get("event_id", "")
        saga_id = data.get("saga_id", "")
        correlation_id = data.get("correlation_id", "")
        payload = data.get("payload", {})
        order_id = payload.get("order_id")
        customer_id = payload.get("customer_id")

        logger.info("consumer_received event_type=%s saga_id=%s correlation_id=%s event_id=%s", event_type, saga_id, correlation_id, event_id)

        if ProcessedEvent.objects.filter(event_id=event_id).exists():
            logger.info("consumer_duplicate_event event_id=%s - skipping", event_id)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        if event_type == "inventory.reserve.requested":
            _handle_inventory_reserve(order_id, customer_id, saga_id, correlation_id, payload.get("items", []), payload)
        elif event_type == "inventory.commit.requested":
            _handle_inventory_commit(order_id, customer_id, saga_id, correlation_id)
        elif event_type == "inventory.release.requested":
            _handle_inventory_release(order_id, customer_id, saga_id, correlation_id)
        else:
            logger.warning("consumer_unknown_event event_type=%s", event_type)

        ProcessedEvent.objects.create(event_id=event_id)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as exc:
        logger.exception("consumer_processing_error event_id=%s error=%s", data.get("event_id", ""), exc)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


class Command(BaseCommand):
    help = "Consume RabbitMQ events for inventory-service"

    def handle(self, *args, **options):
        while True:
            try:
                parameters = pika.URLParameters(RABBITMQ_URL)
                connection = pika.BlockingConnection(parameters)
                channel = connection.channel()

                channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type="topic", durable=True)
                channel.queue_declare(queue=QUEUE_NAME, durable=True)
                for key in BINDING_KEYS:
                    channel.queue_bind(exchange=EXCHANGE_NAME, queue=QUEUE_NAME, routing_key=key)

                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=QUEUE_NAME, on_message_callback=_process_message)

                logger.info("inventory-consumer started, waiting for events on queue=%s", QUEUE_NAME)
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.warning("inventory-consumer connection lost: %s - reconnecting in 5s", exc)
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("inventory-consumer stopped")
                break
            except Exception as exc:
                logger.exception("inventory-consumer unexpected error: %s - reconnecting in 5s", exc)
                time.sleep(5)

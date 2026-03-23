import json
import logging
import os
import time

import pika
from django.core.management.base import BaseCommand
from django.db import transaction

from app.models import ProcessedEvent, Shipment

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "bookstore.topic"
QUEUE_NAME = "ship_service_queue"
BINDING_KEYS = ["shipping.reserve.requested", "shipping.compensate.requested"]


def _publish_or_raise(event_type, payload, correlation_id, saga_id):
    from app.events import publish_event

    if not publish_event(event_type, payload, correlation_id=correlation_id, saga_id=saga_id):
        raise RuntimeError(f"Failed to publish {event_type}")


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
        force_shipping_failure = payload.get("force_shipping_failure", False)

        logger.info(
            "consumer_received event_type=%s saga_id=%s correlation_id=%s event_id=%s",
            event_type, saga_id, correlation_id, event_id,
        )

        if ProcessedEvent.objects.filter(event_id=event_id).exists():
            logger.info("consumer_duplicate_event event_id=%s - skipping", event_id)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        with transaction.atomic():
            if event_type == "shipping.reserve.requested":
                _handle_shipping_reserve(order_id, customer_id, saga_id, correlation_id, force_shipping_failure)
            elif event_type == "shipping.compensate.requested":
                _handle_shipping_compensate(order_id, saga_id, correlation_id)
            else:
                logger.warning("consumer_unknown_event event_type=%s", event_type)

            ProcessedEvent.objects.create(event_id=event_id)

        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as exc:
        logger.exception("consumer_processing_error event_id=%s error=%s", data.get("event_id", ""), exc)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


def _handle_shipping_reserve(order_id, customer_id, saga_id, correlation_id, force_shipping_failure):
    if force_shipping_failure:
        shipment = Shipment.objects.create(
            order_id=order_id,
            shipping_method="STANDARD",
            address=f"Customer {customer_id} address",
            status="FAILED",
        )
        logger.warning("shipping_reserve_failed order_id=%s saga_id=%s (forced)", order_id, saga_id)
        _publish_or_raise(
            "shipping.reserve.completed",
            {"order_id": order_id, "success": False, "shipment_id": shipment.id},
            correlation_id=correlation_id,
            saga_id=saga_id,
        )
    else:
        shipment = Shipment.objects.create(
            order_id=order_id,
            shipping_method="STANDARD",
            address=f"Customer {customer_id} address",
            status="RESERVED",
        )
        logger.info("shipping_reserve_completed order_id=%s saga_id=%s shipment_id=%s", order_id, saga_id, shipment.id)
        _publish_or_raise(
            "shipping.reserve.completed",
            {"order_id": order_id, "success": True, "shipment_id": shipment.id},
            correlation_id=correlation_id,
            saga_id=saga_id,
        )


def _handle_shipping_compensate(order_id, saga_id, correlation_id):
    updated = Shipment.objects.filter(order_id=order_id).update(status="CANCELLED")
    logger.info("shipping_compensated order_id=%s saga_id=%s updated=%d", order_id, saga_id, updated)
    _publish_or_raise(
        "shipping.compensate.completed",
        {"order_id": order_id, "success": True},
        correlation_id=correlation_id,
        saga_id=saga_id,
    )


class Command(BaseCommand):
    help = "Consume RabbitMQ events for ship-service"

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

                logger.info("ship-consumer started, waiting for events on queue=%s", QUEUE_NAME)
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.warning("ship-consumer connection lost: %s - reconnecting in 5s", exc)
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("ship-consumer stopped")
                break
            except Exception as exc:
                logger.exception("ship-consumer unexpected error: %s - reconnecting in 5s", exc)
                time.sleep(5)
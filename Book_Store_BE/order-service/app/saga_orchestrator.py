import logging
import os

import requests
from django.db import transaction

from .events import publish_event
from .models import Order, OrderItem

logger = logging.getLogger(__name__)

CART_SERVICE_URL = os.environ.get("CART_SERVICE_URL", "http://cart-service:8000")


def _order_items_payload(order):
    return [
        {"book_id": item.book_id, "quantity": item.quantity}
        for item in OrderItem.objects.filter(order=order).order_by("id")
    ]


def _publish_or_raise(event_type, payload, correlation_id, saga_id):
    published, _ = publish_event(event_type, payload, correlation_id=correlation_id, saga_id=saga_id)
    if not published:
        raise RuntimeError(f"Failed to publish {event_type}")


def _clear_customer_cart(customer_id):
    try:
        response = requests.delete(f"{CART_SERVICE_URL}/carts/{customer_id}/", timeout=3)
        if response.status_code not in (200, 204, 404):
            logger.warning("cart_clear_unexpected_status customer_id=%s status=%s", customer_id, response.status_code)
    except requests.RequestException as exc:
        logger.warning("cart_clear_failed customer_id=%s error=%s", customer_id, exc)


def handle_inventory_result(saga_id, success, message="", payload=None):
    if payload is None:
        payload = {}
    try:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(saga_id=saga_id)
            if order.status != "PENDING":
                logger.info(
                    "saga_inventory_result_ignored saga_id=%s order_id=%s current_status=%s",
                    saga_id, order.id, order.status,
                )
                return

            if success:
                order.status = "INVENTORY_RESERVED"
                order.save(update_fields=["status"])
                _publish_or_raise(
                    "payment.reserve.requested",
                    {
                        "order_id": order.id,
                        "customer_id": order.customer_id,
                        "total_price": float(order.total_price),
                        "items": _order_items_payload(order),
                        "force_payment_failure": payload.get("force_payment_failure", False),
                        "force_shipping_failure": payload.get("force_shipping_failure", False),
                    },
                    correlation_id=order.correlation_id,
                    saga_id=order.saga_id,
                )
            else:
                order.status = "CANCELLED"
                order.save(update_fields=["status"])
                logger.warning("saga_inventory_failed saga_id=%s order_id=%s message=%s", saga_id, order.id, message)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=inventory_result", saga_id)


def handle_payment_result(saga_id, success, message="", payload=None):
    if payload is None:
        payload = {}
    try:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(saga_id=saga_id)
            if order.status != "INVENTORY_RESERVED":
                logger.info(
                    "saga_payment_result_ignored saga_id=%s order_id=%s current_status=%s",
                    saga_id, order.id, order.status,
                )
                return

            if success:
                order.status = "PAYMENT_RESERVED"
                order.save(update_fields=["status"])
                _publish_or_raise(
                    "shipping.reserve.requested",
                    {
                        "order_id": order.id,
                        "customer_id": order.customer_id,
                        "force_shipping_failure": payload.get("force_shipping_failure", False),
                    },
                    correlation_id=order.correlation_id,
                    saga_id=order.saga_id,
                )
            else:
                order.status = "COMPENSATING"
                order.save(update_fields=["status"])
                _publish_or_raise(
                    "inventory.release.requested",
                    {
                        "order_id": order.id,
                        "customer_id": order.customer_id,
                        "items": _order_items_payload(order),
                    },
                    correlation_id=order.correlation_id,
                    saga_id=order.saga_id,
                )
                logger.warning("saga_payment_failed saga_id=%s order_id=%s message=%s", saga_id, order.id, message)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=payment_result", saga_id)


def handle_shipping_result(saga_id, success, message="", payload=None):
    if payload is None:
        payload = {}
    try:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(saga_id=saga_id)
            if order.status != "PAYMENT_RESERVED":
                logger.info(
                    "saga_shipping_result_ignored saga_id=%s order_id=%s current_status=%s",
                    saga_id, order.id, order.status,
                )
                return

            if success:
                _publish_or_raise(
                    "inventory.commit.requested",
                    {
                        "order_id": order.id,
                        "customer_id": order.customer_id,
                        "items": _order_items_payload(order),
                    },
                    correlation_id=order.correlation_id,
                    saga_id=order.saga_id,
                )
            else:
                order.status = "COMPENSATING"
                order.save(update_fields=["status"])
                _publish_or_raise(
                    "payment.compensate.requested",
                    {"order_id": order.id, "customer_id": order.customer_id},
                    correlation_id=order.correlation_id,
                    saga_id=order.saga_id,
                )
                logger.warning("saga_shipping_failed_compensating saga_id=%s order_id=%s message=%s", saga_id, order.id, message)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=shipping_result", saga_id)


def handle_payment_compensate_result(saga_id, success, message="", payload=None):
    if payload is None:
        payload = {}
    try:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(saga_id=saga_id)
            if order.status != "COMPENSATING":
                return
            if success:
                _publish_or_raise(
                    "inventory.release.requested",
                    {
                        "order_id": order.id,
                        "customer_id": order.customer_id,
                        "items": _order_items_payload(order),
                    },
                    correlation_id=order.correlation_id,
                    saga_id=order.saga_id,
                )
            else:
                order.status = "FAILED"
                order.save(update_fields=["status"])
                logger.error("saga_payment_compensation_failed saga_id=%s order_id=%s message=%s", saga_id, order.id, message)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=compensate_result", saga_id)


def handle_inventory_commit_result(saga_id, success, message="", payload=None):
    if payload is None:
        payload = {}
    try:
        customer_id = None
        with transaction.atomic():
            order = Order.objects.select_for_update().get(saga_id=saga_id)
            if order.status != "PAYMENT_RESERVED":
                logger.info(
                    "saga_inventory_commit_ignored saga_id=%s order_id=%s current_status=%s",
                    saga_id, order.id, order.status,
                )
                return
            if success:
                order.status = "CONFIRMED"
                order.save(update_fields=["status"])
                customer_id = order.customer_id
            else:
                order.status = "FAILED"
                order.save(update_fields=["status"])
                logger.error("saga_inventory_commit_failed saga_id=%s order_id=%s message=%s", saga_id, order.id, message)
        if success and customer_id is not None:
            _clear_customer_cart(customer_id)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=inventory_commit_result", saga_id)


def handle_inventory_release_result(saga_id, success, message="", payload=None):
    if payload is None:
        payload = {}
    try:
        with transaction.atomic():
            order = Order.objects.select_for_update().get(saga_id=saga_id)
            if order.status != "COMPENSATING":
                logger.info(
                    "saga_inventory_release_ignored saga_id=%s order_id=%s current_status=%s",
                    saga_id, order.id, order.status,
                )
                return
            if success:
                order.status = "CANCELLED"
                order.save(update_fields=["status"])
            else:
                order.status = "FAILED"
                order.save(update_fields=["status"])
                logger.error("saga_inventory_release_failed saga_id=%s order_id=%s message=%s", saga_id, order.id, message)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=inventory_release_result", saga_id)
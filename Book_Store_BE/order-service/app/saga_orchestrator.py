import logging
import uuid
from .models import Order
from .events import publish_event

logger = logging.getLogger(__name__)

def handle_payment_failed(saga_id, message="", payload=None):
    """Handle when payment creation fails"""
    if payload is None:
        payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        if order.status != "PENDING":
            logger.info(
                "saga_payment_failed_ignored saga_id=%s order_id=%s current_status=%s",
                saga_id, order.id, order.status,
            )
            return

        order.status = "CANCELLED"
        order.save(update_fields=["status"])
        logger.warning(
            "saga_payment_failed saga_id=%s order_id=%s message=%s",
            saga_id, order.id, message,
        )
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=payment_failed", saga_id)


def handle_order_complete(saga_id, message="", payload=None):
    """Handle when order delivery is confirmed by client"""
    if payload is None:
        payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        if order.status != "SHIPPING":
            logger.info(
                "saga_order_complete_ignored saga_id=%s order_id=%s current_status=%s",
                saga_id, order.id, order.status,
            )
            return

        order.status = "CONFIRMED"
        order.save(update_fields=["status"])
        logger.info(
            "saga_order_confirmed saga_id=%s order_id=%s correlation_id=%s",
            saga_id, order.id, order.correlation_id,
        )
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=order_complete", saga_id)


def handle_shipment_failed(saga_id, message="", payload=None):
    """Handle when shipment fails - start compensation flow"""
    if payload is None:
        payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        if order.status != "SHIPPING":
            logger.info(
                "saga_shipment_failed_ignored saga_id=%s order_id=%s current_status=%s",
                saga_id, order.id, order.status,
            )
            return

        order.status = "CANCELLED"
        order.save(update_fields=["status"])
        logger.warning(
            "saga_shipment_failed_start_compensation saga_id=%s order_id=%s message=%s",
            saga_id, order.id, message,
        )
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=shipment_failed", saga_id)


def handle_order_compensate_completed(saga_id, success, message="", payload=None):
    """Handle when compensation (refund) is completed"""
    if payload is None:
        payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        # If status is CANCELLED already, no need to update again
        if order.status != "CANCELLED":
            order.status = "CANCELLED"
            order.save(update_fields=["status"])
            
        logger.info(
            "saga_order_compensated_completed saga_id=%s order_id=%s success=%s",
            saga_id, order.id, success,
        )
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=order_compensate_completed", saga_id)



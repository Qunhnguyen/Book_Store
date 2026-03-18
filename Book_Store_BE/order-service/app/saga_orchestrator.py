import logging
import uuid
from .models import Order
from .events import publish_event

logger = logging.getLogger(__name__)

def handle_payment_result(saga_id, success, message="", payload=None):
    if payload is None: payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        # Idempotency check: if order is already past PENDING, don't re-process payment reserve
        if order.status != "PENDING":
            logger.info(
                "saga_payment_result_ignored saga_id=%s order_id=%s current_status=%s",
                saga_id, order.id, order.status,
            )
            return

        if success:
            order.status = "PAYMENT_RESERVED"
            order.save(update_fields=["status"])
            logger.info(
                "saga_payment_reserved saga_id=%s order_id=%s correlation_id=%s",
                saga_id, order.id, order.correlation_id,
            )

            # Publish shipping reserve request
            publish_payload = {
                "order_id": order.id,
                "customer_id": order.customer_id,
                "force_shipping_failure": payload.get("force_shipping_failure", False)
            }
            publish_event("shipping.reserve.requested", publish_payload, correlation_id=order.correlation_id, saga_id=order.saga_id)
        else:
            order.status = "CANCELLED"
            order.save(update_fields=["status"])
            logger.warning(
                "saga_payment_failed saga_id=%s order_id=%s message=%s",
                saga_id, order.id, message,
            )
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=payment_result", saga_id)

def handle_shipping_result(saga_id, success, message="", payload=None):
    if payload is None: payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        # Idempotency check: only process shipping result if order is PAYMENT_RESERVED
        if order.status != "PAYMENT_RESERVED":
            logger.info(
                "saga_shipping_result_ignored saga_id=%s order_id=%s current_status=%s",
                saga_id, order.id, order.status,
            )
            return

        if success:
            order.status = "CONFIRMED"
            order.save(update_fields=["status"])
            logger.info(
                "saga_confirmed saga_id=%s order_id=%s correlation_id=%s",
                saga_id, order.id, order.correlation_id,
            )
        else:
            order.status = "COMPENSATING"
            order.save(update_fields=["status"])
            logger.warning(
                "saga_shipping_failed_compensating saga_id=%s order_id=%s message=%s",
                saga_id, order.id, message,
            )

            # Start compensation
            publish_payload = {
                "order_id": order.id,
                "customer_id": order.customer_id
            }
            publish_event("payment.compensate.requested", publish_payload, correlation_id=order.correlation_id, saga_id=order.saga_id)
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=shipping_result", saga_id)

def handle_payment_compensate_result(saga_id, success, message="", payload=None):
    if payload is None: payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        if order.status == "COMPENSATING":
            order.status = "CANCELLED"
            order.save(update_fields=["status"])
            logger.info(
                "saga_cancelled_after_compensation saga_id=%s order_id=%s",
                saga_id, order.id,
            )
    except Order.DoesNotExist:
        logger.error("saga_order_not_found saga_id=%s event=compensate_result", saga_id)



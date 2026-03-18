import uuid
from .models import Order
from .events import publish_event

def handle_payment_result(saga_id, success, message="", payload=None):
    if payload is None: payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        # Idempotency check: if order is already past PENDING, don't re-process payment reserve
        if order.status != "PENDING":
            print(f"Saga {saga_id} payment result ignored: Order status is already {order.status}")
            return
            
        if success:
            order.status = "PAYMENT_RESERVED"
            order.save(update_fields=["status"])
            
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
            print(f"Payment failed for saga {saga_id}: {message}")
    except Order.DoesNotExist:
        print(f"Saga {saga_id} not found for payment result")

def handle_shipping_result(saga_id, success, message="", payload=None):
    if payload is None: payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        # Idempotency check: only process shipping result if order is PAYMENT_RESERVED
        if order.status != "PAYMENT_RESERVED":
            print(f"Saga {saga_id} shipping result ignored: Order status is already {order.status}")
            return
            
        if success:
            order.status = "CONFIRMED"
            order.save(update_fields=["status"])
        else:
            order.status = "COMPENSATING"
            order.save(update_fields=["status"])
            
            # Start compensation details
            publish_payload = {
                "order_id": order.id,
                "customer_id": order.customer_id
            }
            publish_event("payment.compensate.requested", publish_payload, correlation_id=order.correlation_id, saga_id=order.saga_id)
    except Order.DoesNotExist:
        print(f"Saga {saga_id} not found for shipping result")

def handle_payment_compensate_result(saga_id, success, message="", payload=None):
    if payload is None: payload = {}
    try:
        order = Order.objects.get(saga_id=saga_id)
        if order.status == "COMPENSATING":
            order.status = "CANCELLED"  # Finally cancelled after compensation
            order.save(update_fields=["status"])
    except Order.DoesNotExist:
        print(f"Saga {saga_id} not found for compensation result")

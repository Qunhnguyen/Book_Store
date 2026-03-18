import json
import os
import time
import requests
import uuid
import pika

API_URL = "http://api-gateway:8000/api"
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

def test_saga():
    print("=== 1. Registering Customer ===")
    email = f"testsaga{uuid.uuid4().hex[:6]}@example.com"
    requests.post(f"{API_URL}/register/", json={
        "name": "testsaga", "email": email, "password": "123", "phone": "555-0000"
    })
    login = requests.post(f"{API_URL}/login/", json={"email": email, "password": "123"}).json()
    token = login["token"]
    customer_id = login["customer_id"]
    headers = {"Authorization": f"Bearer {token}"}

    print("=== 2. Creating order ===")
    cart_resp = requests.post(f"{API_URL}/carts/", json={"customer_id": customer_id}, headers=headers).json()
    cart_id = cart_resp["id"]
    requests.post(f"{API_URL}/cart-items/", json={"cart": cart_id, "book_id": 1, "quantity": 1}, headers=headers)

    order_resp = requests.post(f"{API_URL}/orders/", json={"customer_id": customer_id, "total_amount": 29.99}, headers=headers).json()
    if "id" not in order_resp:
        print(f"FAILED to create order: {order_resp}")
        return
    order_id = order_resp["id"]
    saga_id = order_resp["saga_id"]
    correlation_id = order_resp["correlation_id"]

    print(f"Order created: ID={order_id}, Status={order_resp['status']}, SagaID={saga_id}")
    if order_resp['status'] != "PENDING":
        print("FAIL: Expected status PENDING")
        return

    # Setup RabbitMQ
    parameters = pika.URLParameters(RABBITMQ_URL)
    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    exchange_name = "bookstore.topic"
    channel.exchange_declare(exchange=exchange_name, exchange_type='topic', durable=True)

    def publish_mock_response(event_type):
        msg = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "event_version": "1.0",
            "saga_id": saga_id,
            "correlation_id": correlation_id,
            "timestamp": int(time.time()),
            "payload": {
                "order_id": order_id,
                "customer_id": customer_id,
                "success": True,
                "message": "Mock success"
            }
        }
        channel.basic_publish(exchange=exchange_name, routing_key=event_type, body=json.dumps(msg))
        print(f" [x] Published {event_type}")

    print("\n=== 3. Simulating Payment Success ===")
    publish_mock_response("payment.reserve.completed")
    time.sleep(1) # wait for consumer

    # Fetch order to see if it changed
    orders = requests.get(f"{API_URL}/orders/{customer_id}/", headers=headers).json()
    updated_order = [o for o in orders if o["id"] == order_id][0]
    print(f"Order Status after Payment: {updated_order['status']}")
    if updated_order['status'] != "PAYMENT_RESERVED":
        print("FAIL: Expected status PAYMENT_RESERVED")
        return

    print("\n=== 4. Simulating Shipping Success ===")
    publish_mock_response("shipping.reserve.completed")
    time.sleep(1)

    orders = requests.get(f"{API_URL}/orders/{customer_id}/", headers=headers).json()
    updated_order = [o for o in orders if o["id"] == order_id][0]
    print(f"Order Status after Shipping: {updated_order['status']}")
    if updated_order['status'] != "CONFIRMED":
        print("FAIL: Expected status CONFIRMED")
        return

    print("\n=== SUCCESS: Phase 3 tests passed! ===")
    connection.close()

if __name__ == "__main__":
    test_saga()

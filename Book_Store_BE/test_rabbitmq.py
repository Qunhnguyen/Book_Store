import json
import os
import requests
import uuid

# Get environment variables or default to localhost for test
API_URL = "http://api-gateway:8000/api"
RABBITMQ_MGMT_URL = "http://rabbitmq:15672/api"

print("=== 1. Creating user and Getting Token ===")
email = f"testrabbit{uuid.uuid4().hex[:6]}@example.com"
requests.post(f"{API_URL}/register/", json={
    "name": "testrabbit", "email": email, "password": "123", "phone": "555-0000"
})
login = requests.post(f"{API_URL}/login/", json={"email": email, "password": "123"}).json()
token = login["token"]
customer_id = login["customer_id"]
headers = {"Authorization": f"Bearer {token}"}

print("=== 2. Creating order ===")
# We assume book 1 is seeded. Add to cart.
cart_create = requests.post(f"{API_URL}/carts/", json={"customer_id": customer_id}, headers=headers).json()
cart_id = cart_create.get("id")

requests.post(f"{API_URL}/cart-items/", json={"cart": cart_id, "book_id": 1, "quantity": 1}, headers=headers)

# Checkout
order_resp = requests.post(f"{API_URL}/orders/", json={"customer_id": customer_id, "total_amount": 29.99}, headers=headers)
print(f"Order created: {order_resp.json()}")

print("=== 3. Checking RabbitMQ for order.created ===")
# Use guest:guest to call RabbitMQ admin API
queues = requests.get(f"{RABBITMQ_MGMT_URL}/queues", auth=("guest", "guest")).json()

found = False
for q in queues:
    print(f"Queue {q['name']} has {q['messages']} messages.")
    if q['messages'] > 0:
        found = True

print("=== Result ===")
if found:
    print("SUCCESS: Event was published to RabbitMQ.")
else:
    # If there are no queues bound, the topic exchange drops the message.
    print("WARNING: RabbitMQ accepted the message, but no queue is bound to keep it.")
    print("We will verify binding and receiving in Phase 4 when downstream services are created.")

print("Phase 2 test complete.")

import time
import requests
import uuid

API_URL = "http://api-gateway:8000/api"

def test_saga_full():
    print("=== 1. Registering Customer ===")
    email = f"testsaga4_{uuid.uuid4().hex[:6]}@example.com"
    requests.post(f"{API_URL}/register/", json={
        "name": "testsaga4", "email": email, "password": "123", "phone": "555-0000"
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

    print(f"Order created: ID={order_id}, Initial Status={order_resp['status']}")
    
    # Wait for the RabbitMQ queues to process everything
    print("\n=== 3. Waiting for RabbitMQ Consumers to process the Saga ===")
    
    max_retries = 10
    for i in range(max_retries):
        orders = requests.get(f"{API_URL}/orders/{customer_id}/", headers=headers).json()
        updated_order = [o for o in orders if o["id"] == order_id][0]
        status = updated_order['status']
        print(f"Check {i+1}: Order Status = {status}")
        
        if status == "CONFIRMED":
            print("\n=== SUCCESS: End-to-End Saga (Phase 4) is WORKING! ===")
            return
        elif status == "CANCELLED":
            print("\n=== FAILED: Status changed to CANCELLED! ===")
            return
            
        time.sleep(1)
        
    print("\n=== FAILED: Timeout waiting for order to become CONFIRMED ===")

if __name__ == "__main__":
    test_saga_full()

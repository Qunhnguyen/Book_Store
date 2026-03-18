import requests
import time
import json
import sys

GATEWAY_URL = 'http://api-gateway:8000'
API_CUSTOMER_URL = f'{GATEWAY_URL}/api/customers/'
API_CART_URL = f'{GATEWAY_URL}/api/carts/'
API_ORDER_URL = f'{GATEWAY_URL}/api/orders/'

def run_test_scenario(scenario_name, payload_flags):
    print(f"\n=========================================")
    print(f"=== SCENARIO: {scenario_name} ===")
    print(f"=========================================\n")
    
    # 1. Register a new customer
    print("--- 1. Registering Customer ---")
    import uuid
    email = f"testuser_p5_{int(time.time())}_{uuid.uuid4().hex[:4]}@example.com"
    requests.post(f"{GATEWAY_URL}/api/register/", json={
        "name": "testuser_p5", "email": email, "password": "123", "phone": "555-0000"
    })
    
    login_response = requests.post(f"{GATEWAY_URL}/api/login/", json={"email": email, "password": "123"})
    if login_response.status_code != 200:
        print(f"FAILED to login: {login_response.text}")
        return False
        
    login_data = login_response.json()
    token = login_data.get("token", "")
    customer_id = login_data.get("customer_id")
    
    headers = {
        'Authorization': f'Bearer {token}'
    } if token else {}
    
    print(f"Customer registered & logged in: ID={customer_id}")

    # 2. Add an item to the cart
    print("\n--- 2. Adding item to cart ---")
    cart_resp = requests.post(f"{GATEWAY_URL}/api/carts/", json={"customer_id": customer_id}, headers=headers)
    if cart_resp.status_code not in [200, 201]:
        print(f"FAILED to POST cart: {cart_resp.text}")
        return False
    
    cart_id = cart_resp.json()["id"]
    item_resp = requests.post(f"{GATEWAY_URL}/api/cart-items/", json={"cart": cart_id, "book_id": 1, "quantity": 2}, headers=headers)
    if item_resp.status_code not in [200, 201]:
        print(f"FAILED to add item to cart: {item_resp.text}")
        return False
        
    print("Item added to cart")

    # 3. Create order
    print("\n--- 3. Creating order ---")
    order_payload = {
        "customer_id": customer_id
    }
    order_payload.update(payload_flags)
    
    response = requests.post(API_ORDER_URL, json=order_payload, headers=headers)
    if response.status_code != 201:
        print(f"FAILED to create order: {response.text}")
        return False
        
    order_data = response.json()
    order_id = order_data['id']
    print(f"Order created: ID={order_id}, Initial Status={order_data['status']}")

    # 4. Wait for Phase 5 Saga to complete
    print("\n--- 4. Polling for final status ---")
    max_retries = 15
    for i in range(1, max_retries + 1):
        time.sleep(1)
        response = requests.get(f"{API_ORDER_URL}{customer_id}/", headers=headers)
        if response.status_code == 200:
            orders = response.json()
            updated_order = next((o for o in orders if o["id"] == order_id), None)
            if updated_order:
                current_status = updated_order.get('status')
            print(f"Check {i}: Order Status = {current_status}")
            
            if scenario_name == 'Happy Path' and current_status == 'CONFIRMED':
                print(f" => SUCCESS: Happy path verified!")
                return True
                
            if scenario_name == 'Payment Failure' and current_status == 'CANCELLED':
                print(f" => SUCCESS: Payment failure gracefully aborted the saga!")
                return True
                
            if scenario_name == 'Shipping Failure' and current_status == 'CANCELLED':
                print(f" => SUCCESS: Shipping failure triggered compensation and aborted the saga!")
                return True
                
    print(f" => FAILED: Timeout waiting for expected final status.")
    return False

if __name__ == '__main__':
    all_passed = True
    
    all_passed &= run_test_scenario(
        "Happy Path", 
        {"force_payment_failure": False, "force_shipping_failure": False}
    )
    
    all_passed &= run_test_scenario(
        "Payment Failure", 
        {"force_payment_failure": True, "force_shipping_failure": False}
    )
    
    all_passed &= run_test_scenario(
        "Shipping Failure", 
        {"force_payment_failure": False, "force_shipping_failure": True}
    )
    
    if all_passed:
        print("\n\n=== ALL PHASE 5 COMPENSATION TESTS PASSED SUCCESSFULLY ===")
        sys.exit(0)
    else:
        print("\n\n=== SOME PHASE 5 TESTS FAILED ===")
        sys.exit(1)

#!/usr/bin/env python3
"""Quick Phase 1 JWT Test"""
import requests
import json

GATEWAY = "http://api-gateway:8000"

print("=== PHASE 1: JWT Authentication ===\n")

# 1. Register
print("1. Register Customer")
r = requests.post(f"{GATEWAY}/api/register/", json={
    "name": "jwt_test_user",
    "email": "jwt_test@test.com",
    "password": "pass123"
})
print(f"   Status: {r.status_code} (expect 201)")
if r.status_code != 201:
    print(f"   Error: {r.text}")

# 2. Login
print("\n2. Login")
r = requests.post(f"{GATEWAY}/api/login/", json={
    "email": "jwt_test@test.com",
    "password": "pass123"
})
print(f"   Status: {r.status_code} (expect 200)")
data = r.json() if r.status_code == 200 else {}
token = data.get("token", "")
cust_id = data.get("customer_id", "")
print(f"   Token: {token[:30]}..." if token else "   Token: FAILED")
print(f"   Customer ID: {cust_id}")

# 3. Try protected endpoint WITHOUT token (expect 401)
print("\n3. POST /api/carts/ WITHOUT token")
r = requests.post(f"{GATEWAY}/api/carts/", json={"customer_id": cust_id})
print(f"   Status: {r.status_code} (expect 401)")
if r.status_code != 401:
    print(f"   ERROR: Expected 401, got {r.status_code}")

# 4. Try protected endpoint WITH token (expect 201)
print("\n4. POST /api/carts/ WITH token")
r = requests.post(f"{GATEWAY}/api/carts/", 
    json={"customer_id": cust_id},
    headers={"Authorization": f"Bearer {token}"}
)
print(f"   Status: {r.status_code} (expect 201)")
if r.status_code == 201:
    print(f"   ✅ Cart created successfully")
else:
    print(f"   ERROR: {r.text}")

if token and r.status_code == 201:
    print("\n✅ PHASE 1 JWT TEST PASSED")
else:
    print("\n❌ PHASE 1 JWT TEST FAILED")

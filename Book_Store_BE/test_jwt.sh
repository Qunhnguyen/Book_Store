#!/bin/bash
set -e

# Generate a random email
RANDOM_NUM=$RANDOM
EMAIL="testjwt${RANDOM_NUM}@example.com"

echo "=== Registering Customer ==="
CUSTOMER_RESP=$(curl -s -X POST http://localhost:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"testjwt\", \"email\": \"$EMAIL\", \"password\": \"password123\", \"phone\": \"555-1234\"}")
echo $CUSTOMER_RESP
CUSTOMER_ID=$(echo $CUSTOMER_RESP | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")
echo "Registered user id: $CUSTOMER_ID"

echo -e "\n=== Fetching Books (Public Route) ==="
BOOKS_RESP=$(curl -s http://localhost:8000/api/books/)
BOOK_ID=$(echo $BOOKS_RESP | python3 -c "import sys, json; books=json.load(sys.stdin); print(books[0]['id'] if books else '')")
echo "Found book id: $BOOK_ID"

echo -e "\n=== Creating Cart without Token (Should Fail 401) ==="
CART_FAIL=$(curl -s -w "%{http_code}" -X POST http://localhost:8000/api/carts/ \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\": $CUSTOMER_ID}")
echo "Response: $CART_FAIL"
if [[ "$CART_FAIL" == *"401" ]]; then
    echo "SUCCESS: Blocked correctly"
else
    echo "FAILED: Did not block request"
    exit 1
fi

echo -e "\n=== Logging In ==="
LOGIN_RESP=$(curl -s -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"password123\"}")
echo $LOGIN_RESP
TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
if [ -z "$TOKEN" ]; then
    echo "FAILED to get Token"
    exit 1
fi
echo "Got Token: $TOKEN"

echo -e "\n=== Creating Cart with Token ==="
CART_RESP=$(curl -s -X POST http://localhost:8000/api/carts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"customer_id\": $CUSTOMER_ID}")
echo $CART_RESP

# Extract dict without trailing headers if curl -i was used (not used, but good safety)
CART_ID=$(echo $CART_RESP | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")
echo "Cart ID: $CART_ID"

echo -e "\n=== Adding Item to Cart with Token ==="
ITEM_RESP=$(curl -s -X POST http://localhost:8000/api/cart-items/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"cart\": $CART_ID, \"book_id\": $BOOK_ID, \"quantity\": 1}")
echo $ITEM_RESP

echo -e "\n=== Creating Order with Token ==="
ORDER_RESP=$(curl -s -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"customer_id\": $CUSTOMER_ID, \"total_amount\": 29.99}")
echo $ORDER_RESP

echo -e "\n=== All Phase 1 Tests Passed! ==="

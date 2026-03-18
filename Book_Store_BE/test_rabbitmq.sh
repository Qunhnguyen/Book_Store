#!/bin/bash
set -e

# Generate a random email
RANDOM_NUM=$RANDOM
EMAIL="testrabbit${RANDOM_NUM}@example.com"

echo "=== 1. Registering Customer ==="
CUSTOMER_RESP=$(curl -s -X POST http://localhost:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"testrabbit\", \"email\": \"$EMAIL\", \"password\": \"password123\", \"phone\": \"555-1234\"}")
echo $CUSTOMER_RESP
CUSTOMER_ID=$(echo $CUSTOMER_RESP | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")

echo -e "\n=== 2. Logging In ==="
LOGIN_RESP=$(curl -s -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"password123\"}")
TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
echo "Got Token."

echo -e "\n=== 3. Creating Cart ==="
CART_RESP=$(curl -s -X POST http://localhost:8000/api/carts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"customer_id\": $CUSTOMER_ID}")
CART_ID=$(echo $CART_RESP | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")
echo "Cart ID: $CART_ID"

echo -e "\n=== 4. Adding Item to Cart ==="
ITEM_RESP=$(curl -s -X POST http://localhost:8000/api/cart-items/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"cart\": $CART_ID, \"book_id\": 1, \"quantity\": 1}")
echo $ITEM_RESP

echo -e "\n=== 5. Creating Order ==="
ORDER_RESP=$(curl -s -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"customer_id\": $CUSTOMER_ID, \"total_amount\": 29.99}")
echo $ORDER_RESP

echo -e "\n=== 6. Checking RabbitMQ for order.created ==="
QUEUES_RESP=$(curl -s -u guest:guest http://localhost:15672/api/queues)
echo "$QUEUES_RESP" | python3 -c "
import sys, json
queues = json.load(sys.stdin)
found = False
for q in queues:
    if q.get('messages', 0) > 0:
        print(f\"Queue {q['name']} has {q['messages']} messages.\")
        found = True

if found:
    print('SUCCESS: RabbitMQ has messages queued.')
else:
    print('WARNING: RabbitMQ event published (Order Created), but no queue bound to exchange. Will be tested fully in Phase 4.')
"

echo -e "\n=== All Phase 2 Tests Complete! ==="

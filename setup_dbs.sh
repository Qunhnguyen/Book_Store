#!/bin/bash

echo "Creating virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

echo "Installing dependencies (this might take a moment)..."
for req in $(find . -name "requirements.txt" -maxdepth 2); do
    pip install -r $req
done

SERVICES=(
  "api-gateway"
  "book-service"
  "cart-service"
  "catalog-service"
  "comment-rate-service"
  "customer-service"
  "manager-service"
  "order-service"
  "pay-service"
  "recommender-ai-service"
  "ship-service"
  "staff-service"
)

for SERVICE in "${SERVICES[@]}"; do
  echo "----------------------------------------"
  echo "Migrating $SERVICE"
  cd $SERVICE
  python manage.py makemigrations
  python manage.py migrate
  cd ..
done

echo "----------------------------------------"
echo "Databases created successfully!"

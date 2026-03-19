# Hybrid Saga Refactoring - Testing Guide

## 📋 Thay đổi Chính

### **Quy trình mới (Hybrid: Auto + Manual)**

```
1️⃣ POST /api/orders/              → Order(PENDING) ✅ Auto
   ├─ Publish: payment.create.requested

2️⃣ (Via MQ) Pay-Consumer           → Payment(PENDING) ✅ Auto

3️⃣ PATCH /api/payments/{id}/process/ → Payment(PAID/FAILED) 🔘 Manual
   ├─ Publish: shipment.create.requested (nếu PAID)
   └─ Publish: payment.failed (nếu FAILED)

4️⃣ (Via MQ) Ship-Consumer          → Shipment(PENDING) ✅ Auto

5️⃣ PATCH /api/shipments/{id}/deliver/ → Shipment(DELIVERED/FAILED) 🔘 Manual
   ├─ Publish: order.complete.requested (nếu DELIVERED)
   └─ Publish: payment.compensate.requested (nếu FAILED)

6️⃣ (Via MQ) Order-Consumer         → Order(CONFIRMED/CANCELLED) ✅ Auto
```

---

## 🧪 TEST SCENARIOS

### **Scenario 1: Happy Path (Order → Payment → Shipment → Complete)**

```bash
# 1. Create Order
curl -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{
    "customer_id": 1,
    "force_payment_failure": false,
    "force_shipping_failure": false
  }'

# Response:
# {
#   "id": 10,
#   "customer_id": 1,
#   "status": "PENDING",
#   "total_price": 250000,
#   "saga_id": "...",
#   "correlation_id": "..."
# }

# Verify: Payment created automatically with status=PENDING
$ docker exec book_store_be_postgres psql -U payment_db -d payment_db -c "SELECT * FROM app_payment ORDER BY id DESC LIMIT 1;"

# 2. Process Payment (Manual)
curl -X PATCH http://localhost:8000/api/payments/1/process/ \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"action": "pay"}'

# Response:
# {
#   "id": 1,
#   "order_id": 10,
#   "payment_method": "COD",
#   "status": "PAID"
# }

# Verify: Shipment created automatically with status=PENDING
$ docker exec book_store_be_postgres psql -U shipment_db -d shipment_db -c "SELECT * FROM app_shipment ORDER BY id DESC LIMIT 1;"

# 3. Deliver Shipment (Manual)
curl -X PATCH http://localhost:8000/api/shipments/1/deliver/ \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"action": "confirm"}'

# Response:
# {
#   "id": 1,
#   "order_id": 10,
#   "status": "DELIVERED"
# }

# Verify: Order status changed to CONFIRMED
$ docker exec book_store_be_postgres psql -U order_db -d order_db -c "SELECT * FROM app_order WHERE id=10;"
# Should show: status = CONFIRMED
```

---

### **Scenario 2: Payment Failed (Manual)**

```bash
# 1. Create Order
curl -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 2" \
  -d '{"customer_id": 2}'
# Response: Order ID = 11, Payment should be auto-created with PENDING

# 2. Cancel Payment (Manual)
curl -X PATCH http://localhost:8000/api/payments/2/process/ \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}'

# OR force failure:
curl -X PATCH http://localhost:8000/api/payments/2/process/ \
  -H "Content-Type: application/json" \
  -d '{"action": "pay", "force_failure": true}'

# Response:
# {
#   "status": "FAILED"
# }

# Verify: Order status changed to CANCELLED
$ docker exec book_store_be_postgres psql -U order_db -d order_db -c "SELECT * FROM app_order WHERE id=11;"
# Should show: status = CANCELLED
```

---

### **Scenario 3: Shipment Failed (Compensation Flow)**

```bash
# 1. Create Order & Process Payment
# ... (steps from Scenario 1, up to payment PAID)

# 2. Failed Delivery (Manual)
curl -X PATCH http://localhost:8000/api/shipments/2/deliver/ \
  -H "Content-Type: application/json" \
  -d '{"action": "confirm", "force_failure": true}'

# Response:
# {
#   "id": 2,
#   "status": "FAILED"
# }

# Verify:
# a) Payment status changed to REFUNDED (auto via compensation flow)
$ docker exec book_store_be_postgres psql -U payment_db -d payment_db -c "SELECT * FROM app_payment WHERE id=1 ORDER BY id DESC LIMIT 1;"
# Should show: status = REFUNDED

# b) Order status changed to CANCELLED
$ docker exec book_store_be_postgres psql -U order_db -d order_db -c "SELECT * FROM app_order ORDER BY id DESC LIMIT 1;"
# Should show: status = CANCELLED
```

---

## 📊 Event Flow (New vs Old)

### **Old (Fully Auto Saga):**

```
payment.reserve.requested ─→ payment.reserve.completed ─→ shipping.reserve.requested ─→ shipping.reserve.completed
   (Auto, ~100ms)              (Auto, ~100ms)               (Auto, ~100ms)              (Auto, ~100ms)
```

### **New (Hybrid):**

```
payment.create.requested ─→ 🔘 Manual PATCH /process/ ─→ shipment.create.requested
   (Auto, immediate)        (When client calls)         (Auto, immediate)

   ⏸️ Wait for user ──────────────────────────────────────⏸️ Wait for user

   🔘 Manual PATCH /deliver/ ──→ order.complete.requested
   (When client calls)        (Auto, immediate)
```

---

## 🔧 DB Changes Needed

### **Order Service**

```sql
-- Update order status enum to support new statuses
-- PENDING → PAYMENT_PROCESSING → SHIPPING → CONFIRMED
-- (or CANCELLED at any point for failure cases)

-- New statuses:
-- PAYMENT_PROCESSING: Order waiting for payment confirmation (after payment PENDING)
-- SHIPPING: Order has confirmed payment, waiting for delivery confirmation
```

### **Payment Service**

```sql
-- status values still same (PENDING, PAID, FAILED, REFUNDED)
-- But timing changed: created as PENDING, manual update to PAID
```

### **Shipment Service**

```sql
-- Update status enum
-- NEW: PENDING (created but not delivered)
-- INSTEAD OF: RESERVED (no longer auto-created)
-- SHIPPED → DELIVERED (renamed from RESERVED)
```

---

## 📝 Checklist Before Testing

- [ ] All Order Service refactored (saga_orchestrator, views, consumer)
- [ ] All Pay Service refactored (new endpoint, consumer)
- [ ] All Ship Service refactored (new endpoint, consumer)
- [ ] API Gateway routes updated (payment_process_api, shipment_deliver_api)
- [ ] Docker containers rebuild: `docker-compose up -d --build`
- [ ] Consumers healthy: `docker-compose logs -f order-consumer pay-consumer ship-consumer`
- [ ] RabbitMQ queues verified: `docker exec rabbitmq rabbitmqctl list_queues`

---

## ⚡ Quick Start (If Already Built)

```bash
# 1. Rebuild containers with new code
cd c:\Users\Phung Quoc Viet\Desktop\Thiết kế kiến trúc phần mềm\ass06\Book_Store\Book_Store_BE
docker-compose up -d --build

# 2. Wait for services to be ready (~30s)
sleep 30

# 3. Create test order
curl -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 1" \
  -d '{"customer_id": 1}'

# 4. Check RabbitMQ logs
docker-compose logs order-consumer -f

# 5. Test payment process endpoint
curl -X PATCH http://localhost:8000/api/payments/1/process/ \
  -H "Content-Type: application/json" \
  -d '{"action": "pay"}'

# 6. Test shipment deliver endpoint
curl -X PATCH http://localhost:8000/api/shipments/1/deliver/ \
  -H "Content-Type: application/json" \
  -d '{"action": "confirm"}'

# 7. Verify order status changed to CONFIRMED
curl http://localhost:8000/api/orders/
```

---

## 🎯 Key Differences from Old System

| Aspect                 | Old             | New                       |
| ---------------------- | --------------- | ------------------------- |
| **Payment Creation**   | Auto (RabbitMQ) | Auto (RabbitMQ) ✅        |
| **Payment Processing** | Auto (RabbitMQ) | Manual (API) 🔘           |
| **Shipment Creation**  | Auto (RabbitMQ) | Auto (RabbitMQ) ✅        |
| **Shipment Delivery**  | Auto (RabbitMQ) | Manual (API) 🔘           |
| **Order Complete**     | Auto (RabbitMQ) | Auto (RabbitMQ) ✅        |
| **Total Time**         | ~500ms          | Depends on user actions   |
| **RabbitMQ Events**    | 6-8 per order   | 4-6 per order (-33%)      |
| **Client Control**     | None            | Full (payment & delivery) |

---

## 🚀 Production Considerations

1. **Idempotency:** All endpoints (payment process, shipment deliver) should be idempotent
   - Calling twice with same data should return same result
   - Check `processed_at` timestamp in DB

2. **Timeouts:** Consider adding expiration
   - Payment PENDING > 30 min → auto-CANCELLED
   - Shipment PENDING > 48h → auto-FAILED + refund

3. **Frontend:** Add UI indicators
   - Show "Payment Pending" while waiting for manual confirm
   - Show "Shipping Pending" while waiting for delivery confirm

4. **Monitoring:**
   - Track average time in each state (PENDING, etc.)
   - Alert if payment stuck > 30 min
   - Alert if shipment stuck > 12h

---

**Refactoring completed on: March 19, 2026**

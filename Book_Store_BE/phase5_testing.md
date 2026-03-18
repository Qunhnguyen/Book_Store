# Phase 5: Compensation & Consistency — Hướng dẫn Test

## Mục tiêu Phase 5
- Khi **payment fail**: `order-service` chuyển Order thành `CANCELLED` ngay lập tức.
- Khi **shipping fail** (sau khi payment đã reserved): `order-service` phát event `payment.compensate.requested` để hoàn tiền, rồi chuyển Order thành `CANCELLED`.
- Khi cả hai thành công: Order → `CONFIRMED` (giống Phase 4).
- Idempotency: Ngăn confirm/compensate trùng lặp bằng state machine checks.

## Các file đã thay đổi/tạo mới

| Service | File | Mô tả |
|---|---|---|
| `order-service` | `app/views.py` | Thêm nhận `force_payment_failure`, `force_shipping_failure` từ request body & forward qua RabbitMQ payload |
| `order-service` | `app/saga_orchestrator.py` | Thêm idempotency checks (chỉ xử lý nếu order đúng trạng thái mong đợi) |
| `order-service` | `app/management/commands/run_consumer.py` | Sửa hardcoded `success=True` thành dùng giá trị `success` thực tế từ payload |
| `pay-service` | `app/management/commands/run_consumer.py` | Thêm logic: nếu `force_payment_failure=True` → tạo Payment (FAILED), publish `success=False` |
| `ship-service` | `app/management/commands/run_consumer.py` | Thêm logic: nếu `force_shipping_failure=True` → tạo Shipment (FAILED), publish `success=False` |

## State Machine (Decision Matrix)

```
PENDING
  ├─ payment success → PAYMENT_RESERVED
  │     ├─ shipping success → CONFIRMED ✅
  │     └─ shipping fail → COMPENSATING
  │           └─ payment compensate done → CANCELLED ❌
  └─ payment fail → CANCELLED ❌
```

## Luồng Event chi tiết cho từng kịch bản

### Kịch bản A: Happy Path (Cả hai thành công)
```
order-service: Order=PENDING → publish "payment.reserve.requested"
pay-service: Payment=PAID → publish "payment.reserve.completed" (success=True)
order-service: Order=PAYMENT_RESERVED → publish "shipping.reserve.requested"
ship-service: Shipment=RESERVED → publish "shipping.reserve.completed" (success=True)
order-service: Order=CONFIRMED ✅
```

### Kịch bản B: Payment Failure
```
order-service: Order=PENDING → publish "payment.reserve.requested" (force_payment_failure=True)
pay-service: Payment=FAILED → publish "payment.reserve.completed" (success=False)
order-service: Order=CANCELLED ❌
```

### Kịch bản C: Shipping Failure (Compensation Flow)
```
order-service: Order=PENDING → publish "payment.reserve.requested" (force_shipping_failure=True)
pay-service: Payment=PAID → publish "payment.reserve.completed" (success=True)
order-service: Order=PAYMENT_RESERVED → publish "shipping.reserve.requested" (force_shipping_failure=True)
ship-service: Shipment=FAILED → publish "shipping.reserve.completed" (success=False)
order-service: Order=COMPENSATING → publish "payment.compensate.requested"
pay-service: Payment=REFUNDED → publish "payment.compensate.completed" (success=True)
order-service: Order=CANCELLED ❌
```

## Điều kiện tiên quyết
1. Docker Desktop đang chạy, cấp ≥ 6GB RAM.
2. Toàn bộ stack đã được **build** lại (quan trọng!):
   ```bash
   docker-compose up -d --build
   ```
   > ⚠️ **Lưu ý:** Chỉ `restart` sẽ KHÔNG load code mới vì Docker images dùng COPY, không volume mount. Phải `--build` lại.
3. Database đã có ít nhất 1 cuốn sách (book_id=1).

## Chạy Test Tự Động

```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests pika > /dev/null 2>&1 && python test_phase5.py"
```

### Kết quả mong đợi
```
=== SCENARIO: Happy Path ===
--- 1. Registering Customer ---
Customer registered & logged in: ID=XX
--- 2. Adding item to cart ---
Item added to cart
--- 3. Creating order ---
Order created: ID=XX, Initial Status=PENDING
--- 4. Polling for final status ---
Check 1: Order Status = CONFIRMED
 => SUCCESS: Happy path verified!

=== SCENARIO: Payment Failure ===
...
Check 1: Order Status = CANCELLED
 => SUCCESS: Payment failure gracefully aborted the saga!

=== SCENARIO: Shipping Failure ===
...
Check 1: Order Status = CANCELLED
 => SUCCESS: Shipping failure triggered compensation and aborted the saga!

=== ALL PHASE 5 COMPENSATION TESTS PASSED SUCCESSFULLY ===
```

## Test Thủ Công

### Test Payment Failure
```bash
curl -X POST http://localhost:8000/api/orders/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": <ID>, "force_payment_failure": true}'
```
Kết quả: Order chuyển từ `PENDING` → `CANCELLED`

### Test Shipping Failure
```bash
curl -X POST http://localhost:8000/api/orders/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": <ID>, "force_shipping_failure": true}'
```
Kết quả: Order chuyển `PENDING` → `PAYMENT_RESERVED` → `COMPENSATING` → `CANCELLED`

## Troubleshooting
- **Order vẫn CONFIRMED dù gửi force_failure:** Bạn chưa build lại Docker images. Chạy `docker-compose up -d --build`.
- **RabbitMQ OOMKilled:** Tắt services không cần: `docker-compose stop catalog-service comment-rate-service image-service image-worker manager-service recommender-ai-service staff-service`
- **Consumer crash-loop liên tục:** Kiểm tra `docker-compose logs pay-consumer --tail=20`. Nếu thấy "Name or service not known" → RabbitMQ chưa ready, container sẽ tự restart.

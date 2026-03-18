# Phase 4: Subscribers trong pay-service & ship-service — Hướng dẫn Test

## Mục tiêu Phase 4
- `pay-service` subscribe event `payment.reserve.requested` và `payment.compensate.requested` từ RabbitMQ.
- `ship-service` subscribe event `shipping.reserve.requested` và `shipping.compensate.requested` từ RabbitMQ.
- Mỗi service thực hiện local transaction (tạo Payment/Shipment record) rồi publish event kết quả ngược lại cho `order-service` (Saga orchestrator).
- `order-service` nhận kết quả, chuyển trạng thái Order thành `CONFIRMED` nếu cả hai thành công.
- Idempotency: mỗi service có model `ProcessedEvent` để tránh xử lý trùng event.

## Các file đã thay đổi/tạo mới

| Service | File | Mô tả |
|---|---|---|
| `pay-service` | `app/events.py` | Utility publish event lên RabbitMQ |
| `pay-service` | `app/models.py` | Thêm model `ProcessedEvent` cho idempotency |
| `pay-service` | `app/management/commands/run_consumer.py` | Consumer RabbitMQ xử lý `payment.reserve.requested` và `payment.compensate.requested` |
| `pay-service` | `requirements.txt` | Thêm `pika` |
| `ship-service` | `app/events.py` | Utility publish event lên RabbitMQ |
| `ship-service` | `app/models.py` | Thêm model `ProcessedEvent` cho idempotency |
| `ship-service` | `app/management/commands/run_consumer.py` | Consumer RabbitMQ xử lý `shipping.reserve.requested` và `shipping.compensate.requested` |
| `ship-service` | `requirements.txt` | Thêm `pika` |
| root | `docker-compose.yml` | Thêm services `pay-consumer`, `ship-consumer`, `order-consumer` |

## Luồng Event Phase 4 (Happy Path)

```
Client → POST /api/orders/
  ↓
order-service: tạo Order (PENDING), publish "payment.reserve.requested"
  ↓
pay-consumer: nhận event, tạo Payment (PAID), publish "payment.reserve.completed" (success=True)
  ↓
order-consumer: nhận event, order → PAYMENT_RESERVED, publish "shipping.reserve.requested"
  ↓
ship-consumer: nhận event, tạo Shipment (RESERVED), publish "shipping.reserve.completed" (success=True)
  ↓
order-consumer: nhận event, order → CONFIRMED
```

## Điều kiện tiên quyết
1. Docker Desktop đang chạy, cấp ≥ 6GB RAM.
2. Toàn bộ stack đã được **build** (không chỉ restart):
   ```bash
   docker-compose up -d --build
   ```
3. Database đã có ít nhất 1 cuốn sách (book_id=1). Nếu chưa có:
   ```bash
   docker run --rm --network book_store_be_default -v $(pwd):/app -w /app python:3.11-slim \
     bash -c "pip install requests > /dev/null 2>&1 && python seed_books.py"
   ```

## Chạy Test Tự Động

```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests pika > /dev/null 2>&1 && python test_phase4.py"
```

### Kết quả mong đợi
```
=== 1. Registering Customer ===
=== 2. Creating order ===
Order created: ID=XX, Initial Status=PENDING
=== 3. Waiting for RabbitMQ Consumers to process the Saga ===
Check 1: Order Status = PENDING
Check 2: Order Status = CONFIRMED
=== SUCCESS: End-to-End Saga (Phase 4) is WORKING! ===
```

## Test Thủ Công (nếu cần)

### Bước 1: Đăng ký & đăng nhập
```bash
# Đăng ký
curl -X POST http://localhost:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d '{"name":"testuser","email":"test4@example.com","password":"123","phone":"555"}'

# Đăng nhập → lấy token
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test4@example.com","password":"123"}'
# Ghi nhận token và customer_id
```

### Bước 2: Tạo giỏ hàng & thêm sản phẩm
```bash
curl -X POST http://localhost:8000/api/carts/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": <CUSTOMER_ID>}'
# Ghi nhận cart id

curl -X POST http://localhost:8000/api/cart-items/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"cart": <CART_ID>, "book_id": 1, "quantity": 1}'
```

### Bước 3: Tạo đơn hàng
```bash
curl -X POST http://localhost:8000/api/orders/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": <CUSTOMER_ID>}'
```

### Bước 4: Kiểm tra trạng thái
```bash
# Chờ ~2 giây rồi kiểm tra
curl http://localhost:8000/api/orders/<CUSTOMER_ID>/ \
  -H "Authorization: Bearer <TOKEN>"
```
Order sẽ chuyển: `PENDING` → `PAYMENT_RESERVED` → `CONFIRMED`

## Kiểm tra logs
```bash
docker-compose logs pay-consumer --tail=20
docker-compose logs ship-consumer --tail=20
docker-compose logs order-consumer --tail=20
```

## Troubleshooting
- **RabbitMQ OOMKilled / consumer crash-loop:** Tắt các service không cần thiết:
  ```bash
  docker-compose stop catalog-service comment-rate-service image-service image-worker manager-service recommender-ai-service staff-service
  ```
- **Consumer không nhận event:** Kiểm tra RabbitMQ Management UI tại `http://localhost:15672` (guest/guest).
- **Order vẫn PENDING sau 10s:** Kiểm tra consumer logs xem có lỗi kết nối không.

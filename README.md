# Book Store Backend — Tổng quan Project (Handoff Document)

> Tài liệu này mô tả bức tranh tổng thể của dự án, giúp bạn nắm bắt nhanh khi chuyển sang máy khác hoặc onboard người mới.

---

## 1. Giới thiệu

Dự án **Book Store Backend** là hệ thống **microservices** xây dựng bằng **Django** + **Django REST Framework**, sử dụng **Docker Compose** để orchestrate toàn bộ. Hệ thống đã được nâng cấp qua 6 phase từ kiến trúc REST đồng bộ ban đầu sang **event-driven architecture** với **Saga Pattern**.

---

## 2. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client / Frontend                       │
│                    (React app tại port 3000)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (:8000)                         │
│  • JWT Middleware (verify token, forward X-User-Id header)       │
│  • Route tất cả /api/* tới downstream services                  │
│  • Exempt: /api/register/, /api/login/, /api/books/ (GET)       │
└────┬───────┬──────┬──────┬──────┬──────┬──────┬────────────────┘
     │       │      │      │      │      │      │
     ▼       ▼      ▼      ▼      ▼      ▼      ▼
  customer book   cart   order   pay   ship   các service khác
  :8001   :8002  :8003  :8005  :8006  :8007  (:8008-:8012)
     │       │      │      │      │      │
     │       │      │      ▼      ▼      ▼
     │       │      │  ┌──────────────────────────┐
     │       │      │  │      RabbitMQ (:5672)     │
     │       │      │  │  Exchange: bookstore.topic │
     │       │      │  │  (Topic exchange, durable) │
     │       │      │  └──────────────────────────┘
     │       │      │      │      │      │
     ▼       ▼      ▼      ▼      ▼      ▼
  ┌──────────────────────────────────────────────┐
  │        PostgreSQL (:5432)                     │
  │  13 databases riêng cho từng service          │
  │  (customer_db, book_db, order_db, pay_db,...) │
  └──────────────────────────────────────────────┘
```

---

## 3. Danh sách Services (13 services + 3 consumers)

### Services chính (có business logic + API endpoints)

| Service | Port | Database | Mô tả |
|---|---|---|---|
| `api-gateway` | 8000 | gateway_db | Gateway trung tâm, JWT middleware, proxy tới downstream |
| `customer-service` | 8001 | customer_db | Đăng ký, đăng nhập, phát hành JWT token |
| `book-service` | 8002 | book_db | CRUD sách, trừ stock |
| `cart-service` | 8003 | cart_db | Quản lý giỏ hàng theo customer |
| `order-service` | 8005 | order_db | Tạo đơn hàng, **Saga Orchestrator** |
| `pay-service` | 8006 | pay_db | Quản lý thanh toán |
| `ship-service` | 8007 | ship_db | Quản lý vận chuyển |
| `comment-rate-service` | 8008 | comment_rate_db | Đánh giá, bình luận sách |
| `manager-service` | 8009 | manager_db | Quản lý managers |
| `catalog-service` | 8010 | catalog_db | Danh mục sách |
| `recommender-ai-service` | 8011 | recommender_db | Gợi ý sách AI |
| `image-service` | 8012 | image_db | Upload/resize ảnh (dùng Celery + Redis) |
| `staff-service` | 8004 | staff_db | Quản lý nhân viên |

### Consumer processes (background workers cho RabbitMQ)

| Consumer | Build from | Mô tả |
|---|---|---|
| `order-consumer` | `order-service` | Lắng nghe `payment.*.completed`, `shipping.*.completed` → điều phối Saga |
| `pay-consumer` | `pay-service` | Lắng nghe `payment.reserve.requested`, `payment.compensate.requested` |
| `ship-consumer` | `ship-service` | Lắng nghe `shipping.reserve.requested`, `shipping.compensate.requested` |

### Infrastructure

| Service | Port | Mô tả |
|---|---|---|
| `postgres` | 5432 | PostgreSQL 15, dùng `postgres-init.sh` để tạo 13 databases |
| `rabbitmq` | 5672 / 15672 | RabbitMQ 3 Management, event bus cho Saga |
| `redis` | 6379 | Cache cho `image-service` Celery workers |

---

## 4. Công nghệ sử dụng

| Layer | Technology |
|---|---|
| Backend Framework | Django 4.x + Django REST Framework |
| Database | PostgreSQL 15 (Alpine) |
| Message Broker | RabbitMQ 3 (Management) |
| Python RabbitMQ Client | pika |
| JWT | PyJWT |
| Containerization | Docker + Docker Compose |
| Task Queue (image-service) | Celery + Redis |
| Frontend | React (thư mục riêng `BookstoreFE/`) |

---

## 5. Saga Pattern — Luồng đặt hàng (Event-Driven)

Đây là phần **quan trọng nhất** của project. Thay vì gọi HTTP đồng bộ, order-service dùng **Saga Orchestration qua RabbitMQ**.

### State Machine của Order

```
         POST /orders/
              │
              ▼
          ┌────────┐
          │ PENDING │
          └────┬───┘
               │ publish "payment.reserve.requested"
               ▼
     ┌─────────────────────┐
     │ pay-service xử lý   │
     └─────┬──────┬────────┘
     success=True │  success=False
           │      │
           ▼      ▼
  ┌──────────────┐  ┌───────────┐
  │PAYMENT_RESERVED│  │ CANCELLED │
  └──────┬───────┘  └───────────┘
         │ publish "shipping.reserve.requested"
         ▼
  ┌──────────────────────┐
  │ ship-service xử lý   │
  └─────┬──────┬─────────┘
  success=True │  success=False
        │      │
        ▼      ▼
  ┌──────────┐  ┌──────────────┐
  │ CONFIRMED│  │ COMPENSATING │
  └──────────┘  └──────┬───────┘
                       │ publish "payment.compensate.requested"
                       ▼
                ┌──────────────┐
                │  CANCELLED   │
                └──────────────┘
```

### Event Contract (JSON Schema)

```json
{
  "event_id": "uuid",
  "event_type": "payment.reserve.requested",
  "event_version": "1.0",
  "saga_id": "uuid (unique per order saga)",
  "correlation_id": "uuid",
  "timestamp": 1710753600,
  "payload": {
    "order_id": 1,
    "customer_id": 1,
    "total_price": 59.98,
    "force_payment_failure": false,
    "force_shipping_failure": false
  }
}
```

### Event Types

| Event | Publisher | Consumer | Mô tả |
|---|---|---|---|
| `payment.reserve.requested` | order-service | pay-consumer | Yêu cầu reserve thanh toán |
| `payment.reserve.completed` | pay-service | order-consumer | Kết quả thanh toán (success/fail) |
| `shipping.reserve.requested` | order-service | ship-consumer | Yêu cầu reserve vận chuyển |
| `shipping.reserve.completed` | ship-service | order-consumer | Kết quả vận chuyển (success/fail) |
| `payment.compensate.requested` | order-service | pay-consumer | Yêu cầu hoàn tiền |
| `payment.compensate.completed` | pay-service | order-consumer | Xác nhận hoàn tiền xong |

---

## 6. Cấu trúc thư mục

```
Book_Store_BE/
├── api-gateway/           # Gateway + JWT middleware
├── customer-service/      # Đăng ký, đăng nhập, JWT issuance
├── book-service/          # CRUD sách, stock management
├── cart-service/          # Giỏ hàng
├── order-service/         # ⭐ Saga Orchestrator
│   └── app/
│       ├── events.py            # Publish event helper
│       ├── models.py            # Order, OrderItem (có saga_id, correlation_id)
│       ├── saga_orchestrator.py # State machine logic
│       ├── views.py             # POST /orders/ → khởi tạo Saga
│       └── management/commands/
│           └── run_consumer.py  # Consumer: lắng nghe payment/shipping results
├── pay-service/           # Thanh toán
│   └── app/
│       ├── events.py            # Publish event helper
│       ├── models.py            # Payment, ProcessedEvent (idempotency)
│       └── management/commands/
│           └── run_consumer.py  # Consumer: reserve/compensate payment
├── ship-service/          # Vận chuyển
│   └── app/
│       ├── events.py            # Publish event helper
│       ├── models.py            # Shipment, ProcessedEvent (idempotency)
│       └── management/commands/
│           └── run_consumer.py  # Consumer: reserve/compensate shipping
├── comment-rate-service/  # Review & rating
├── manager-service/       # Manager CRUD
├── catalog-service/       # Categories
├── staff-service/         # Staff management
├── recommender-ai-service/# AI recommendations
├── image-service/         # Image upload + Celery worker
├── docker-compose.yml     # ⭐ Orchestrate toàn bộ (16 services + infra)
├── postgres-init.sh       # Script tạo 13 databases
├── seed_books.py          # Seed dữ liệu sách demo
├── wait-for-postgres.sh   # Health check script cho containers
├── test_phase4.py         # Test script Phase 4 (happy path)
├── test_phase5.py         # Test script Phase 5 (compensation)
├── phase06_hd.md          # Đề bài / yêu cầu thiết kế chi tiết
├── phase0_testing.md      # Hướng dẫn test Phase 0
├── phase1_testing.md      # Hướng dẫn test Phase 1
├── phase2_testing.md      # Hướng dẫn test Phase 2
├── phase3_testing.md      # Hướng dẫn test Phase 3
├── phase4_testing.md      # Hướng dẫn test Phase 4
└── phase5_testing.md      # Hướng dẫn test Phase 5
```

---

## 7. Tiến độ thực hiện theo Phase

| Phase | Tên | Trạng thái | Mô tả |
|---|---|---|---|
| 0 | PostgreSQL Migration | ✅ Hoàn thành | Chuyển SQLite → PostgreSQL, database riêng/service |
| 1 | JWT Authentication | ✅ Hoàn thành | customer-service phát JWT, api-gateway verify |
| 2 | RabbitMQ Infrastructure | ✅ Hoàn thành | Exchange/queue setup, event schema, publish event |
| 3 | Saga Orchestration | ✅ Hoàn thành | order-service orchestrator, state machine, consumer |
| 4 | Subscribers | ✅ Hoàn thành | pay/ship consumers, idempotency, end-to-end happy path |
| 5 | Compensation | ✅ Hoàn thành | Failure injection, refund flow, CANCELLED state |
| 6 | Resilience & Observability | ❌ Chưa làm | Timeout, retry, circuit breaker, health checks, metrics |

---

## 8. Biến môi trường quan trọng

| Biến | Giá trị | Dùng bởi |
|---|---|---|
| `DB_HOST` | `postgres` | Tất cả services |
| `DB_PORT` | `5432` | Tất cả services |
| `DB_NAME` | `<service>_db` | Mỗi service riêng |
| `DB_USER` | `<service>_db` | Mỗi service riêng |
| `DB_PASSWORD` | `<service>_db` | Mỗi service riêng |
| `JWT_SECRET` | `super-secret-key-for-bookstore` | api-gateway, customer-service |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672/` | order, pay, ship services + consumers |

---

## 9. Cách chạy Project từ đầu (trên máy mới)

### Yêu cầu hệ thống
- **Docker Desktop** (≥ 6GB RAM recommended, tối thiểu 4GB)
- **Git** để clone repo
- **Python 3.11+** (chỉ nếu muốn chạy test scripts bên ngoài Docker)

### Bước 1: Clone và build
```bash
git clone <repo-url>
cd Book_Store_BE
docker-compose up -d --build
```

### Bước 2: Chờ tất cả services healthy (~30-60 giây)
```bash
docker ps
# Đảm bảo tất cả containers ở trạng thái "Up"
```

### Bước 3: Seed dữ liệu sách (chỉ lần đầu)
```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests > /dev/null 2>&1 && python seed_books.py"
```

### Bước 4: Nếu RAM ít, tắt services không cần
```bash
docker-compose stop catalog-service comment-rate-service image-service \
  image-worker manager-service recommender-ai-service staff-service
```

### Bước 5: Chạy test Phase 4 (Happy Path)
```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests pika > /dev/null 2>&1 && python test_phase4.py"
```

### Bước 6: Chạy test Phase 5 (Compensation)
```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests pika > /dev/null 2>&1 && python test_phase5.py"
```

---

## 10. Lưu ý khi phát triển tiếp (Phase 6)

Phase 6 theo `phase06_hd.md` yêu cầu:
1. **Resilience:** timeout nhất quán cho HTTP calls, retry cho broker reconnect, circuit breaker cho downstream
2. **Observability:** `/health` endpoint, `/metrics` (Prometheus), structured logging với `correlation_id`/`saga_id`

### Điểm quan trọng cần nhớ:
- **Docker images dùng COPY, KHÔNG có volume mount.** Mỗi khi sửa code Python, phải `docker-compose up -d --build` để rebuild image.
- **RabbitMQ rất dễ bị OOMKilled** nếu Docker Desktop chỉ cấp 2-4GB RAM. Tăng lên ≥ 6GB hoặc tắt bớt services.
- **Consumer retry logic:** Các consumer đều có retry loop (10 lần, mỗi lần chờ 5s) khi kết nối RabbitMQ. Nếu RabbitMQ chưa ready, container sẽ crash rồi `restart: always` sẽ tự khởi động lại.

---

## 11. Các file test script hiện có

| File | Mục đích | Cách chạy |
|---|---|---|
| `test_jwt.sh` | Test JWT authentication (Phase 1) | `bash test_jwt.sh` |
| `test_rabbitmq.sh` | Test RabbitMQ connection (Phase 2) | `bash test_rabbitmq.sh` |
| `test_phase3.py` | Test Saga state transitions (Phase 3) | Chạy trong Docker |
| `test_phase4.py` | Test end-to-end happy path (Phase 4) | Chạy trong Docker |
| `test_phase5.py` | Test compensation flows (Phase 5) | Chạy trong Docker |
| `seed_books.py` | Seed demo books vào book-service | Chạy trong Docker |

---

## 12. RabbitMQ Management

- **URL:** http://localhost:15672
- **Username:** guest
- **Password:** guest
- **Exchange:** `bookstore.topic` (topic exchange, durable)
- **Queues:** `order_service_queue`, `pay_service_queue`, `ship_service_queue`

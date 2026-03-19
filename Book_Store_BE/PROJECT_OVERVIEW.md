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

| Service                  | Port | Database        | Mô tả                                                   |
| ------------------------ | ---- | --------------- | ------------------------------------------------------- |
| `api-gateway`            | 8000 | gateway_db      | Gateway trung tâm, JWT middleware, proxy tới downstream |
| `customer-service`       | 8001 | customer_db     | Đăng ký, đăng nhập, phát hành JWT token                 |
| `book-service`           | 8002 | book_db         | CRUD sách, trừ stock                                    |
| `cart-service`           | 8003 | cart_db         | Quản lý giỏ hàng theo customer                          |
| `order-service`          | 8005 | order_db        | Tạo đơn hàng, **Saga Orchestrator**                     |
| `pay-service`            | 8006 | pay_db          | Quản lý thanh toán                                      |
| `ship-service`           | 8007 | ship_db         | Quản lý vận chuyển                                      |
| `comment-rate-service`   | 8008 | comment_rate_db | Đánh giá, bình luận sách                                |
| `manager-service`        | 8009 | manager_db      | Quản lý managers                                        |
| `catalog-service`        | 8010 | catalog_db      | Danh mục sách                                           |
| `recommender-ai-service` | 8011 | recommender_db  | Gợi ý sách AI                                           |
| `image-service`          | 8012 | image_db        | Upload/resize ảnh (dùng Celery + Redis)                 |
| `staff-service`          | 8004 | staff_db        | Quản lý nhân viên                                       |

### Consumer processes (background workers cho RabbitMQ)

| Consumer         | Build from      | Mô tả                                                                    |
| ---------------- | --------------- | ------------------------------------------------------------------------ |
| `order-consumer` | `order-service` | Lắng nghe `payment.*.completed`, `shipping.*.completed` → điều phối Saga |
| `pay-consumer`   | `pay-service`   | Lắng nghe `payment.reserve.requested`, `payment.compensate.requested`    |
| `ship-consumer`  | `ship-service`  | Lắng nghe `shipping.reserve.requested`, `shipping.compensate.requested`  |

### Infrastructure

| Service    | Port         | Mô tả                                                      |
| ---------- | ------------ | ---------------------------------------------------------- |
| `postgres` | 5432         | PostgreSQL 15, dùng `postgres-init.sh` để tạo 13 databases |
| `rabbitmq` | 5672 / 15672 | RabbitMQ 3 Management, event bus cho Saga                  |
| `redis`    | 6379         | Cache cho `image-service` Celery workers                   |

---

## 4. Công nghệ sử dụng

| Layer                      | Technology                           |
| -------------------------- | ------------------------------------ |
| Backend Framework          | Django 4.x + Django REST Framework   |
| Database                   | PostgreSQL 15 (Alpine)               |
| Message Broker             | RabbitMQ 3 (Management)              |
| Python RabbitMQ Client     | pika                                 |
| JWT                        | PyJWT                                |
| Containerization           | Docker + Docker Compose              |
| Task Queue (image-service) | Celery + Redis                       |
| Frontend                   | React (thư mục riêng `BookstoreFE/`) |

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

| Event                          | Publisher     | Consumer       | Mô tả                             |
| ------------------------------ | ------------- | -------------- | --------------------------------- |
| `payment.reserve.requested`    | order-service | pay-consumer   | Yêu cầu reserve thanh toán        |
| `payment.reserve.completed`    | pay-service   | order-consumer | Kết quả thanh toán (success/fail) |
| `shipping.reserve.requested`   | order-service | ship-consumer  | Yêu cầu reserve vận chuyển        |
| `shipping.reserve.completed`   | ship-service  | order-consumer | Kết quả vận chuyển (success/fail) |
| `payment.compensate.requested` | order-service | pay-consumer   | Yêu cầu hoàn tiền                 |
| `payment.compensate.completed` | pay-service   | order-consumer | Xác nhận hoàn tiền xong           |

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

| Phase | Tên                        | Trạng thái    | Mô tả                                                                   |
| ----- | -------------------------- | ------------- | ----------------------------------------------------------------------- |
| 0     | PostgreSQL Migration       | ✅ Hoàn thành | Chuyển SQLite → PostgreSQL, database riêng/service                      |
| 1     | JWT Authentication         | ✅ Hoàn thành | customer-service phát JWT, api-gateway verify                           |
| 2     | RabbitMQ Infrastructure    | ✅ Hoàn thành | Exchange/queue setup, event schema, publish event                       |
| 3     | Saga Orchestration         | ✅ Hoàn thành | order-service orchestrator, state machine, consumer                     |
| 4     | Subscribers                | ✅ Hoàn thành | pay/ship consumers, idempotency, end-to-end happy path                  |
| 5     | Compensation               | ✅ Hoàn thành | Failure injection, refund flow, CANCELLED state                         |
| 6     | Resilience & Observability | ✅ Hoàn thành | Health checks, Prometheus metrics, circuit breaker, timeout/retry logic |

---

## 8. Biến môi trường quan trọng

| Biến           | Giá trị                             | Dùng bởi                              |
| -------------- | ----------------------------------- | ------------------------------------- |
| `DB_HOST`      | `postgres`                          | Tất cả services                       |
| `DB_PORT`      | `5432`                              | Tất cả services                       |
| `DB_NAME`      | `<service>_db`                      | Mỗi service riêng                     |
| `DB_USER`      | `<service>_db`                      | Mỗi service riêng                     |
| `DB_PASSWORD`  | `<service>_db`                      | Mỗi service riêng                     |
| `JWT_SECRET`   | `super-secret-key-for-bookstore`    | api-gateway, customer-service         |
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

| File               | Mục đích                              | Cách chạy               |
| ------------------ | ------------------------------------- | ----------------------- |
| `test_jwt.sh`      | Test JWT authentication (Phase 1)     | `bash test_jwt.sh`      |
| `test_rabbitmq.sh` | Test RabbitMQ connection (Phase 2)    | `bash test_rabbitmq.sh` |
| `test_phase3.py`   | Test Saga state transitions (Phase 3) | Chạy trong Docker       |
| `test_phase4.py`   | Test end-to-end happy path (Phase 4)  | Chạy trong Docker       |
| `test_phase5.py`   | Test compensation flows (Phase 5)     | Chạy trong Docker       |
| `seed_books.py`    | Seed demo books vào book-service      | Chạy trong Docker       |

---

## 12. RabbitMQ Management

- **URL:** http://localhost:15672
- **Username:** guest
- **Password:** guest
- **Exchange:** `bookstore.topic` (topic exchange, durable)
- **Queues:** `order_service_queue`, `pay_service_queue`, `ship_service_queue`

---

## 13. Xử lý Ảnh Bìa Sách (Book Cover Processing)

### Tổng quan

Dự án sử dụng **Open Library API** để lấy ảnh bìa sách chính xác từ thư viện số lớn nhất thế giới. Quy trình:

1. **Mỗi sách lưu ISBN** trong database (book-service)
2. **Gọi script `fetch_covers.py`** → query Open Library API theo ISBN → lấy URL ảnh bìa
3. **Cập nhật vào database** field `official_cover_url` và `image_source = OFFICIAL`
4. **Frontend hiển thị** từ `official_cover_url` khi sách có cover official

### Script fetch_covers.py

**Vị trí:** `Book_Store_BE/fetch_covers.py`

**Chức năng:**

- Fetch danh sách sách từ `/api/books/` (gateway)
- Với mỗi sách, query Open Library API: `https://openlibrary.org/isbn/{isbn}.json`
- Extract cover ID từ kết quả, build URL: `https://covers.openlibrary.org/b/id/{cover_id}-L.jpg`
- PATCH cập nhật vào `/api/books/{book_id}/` với `official_cover_url` + `image_source=OFFICIAL`
- Log result cho mỗi sách: `✅ COVER FOUND` hoặc `❌ NOT FOUND`

**Cách chạy:**

```bash
# Chạy trong Docker network
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests > /dev/null 2>&1 && python fetch_covers.py"
```

**Output mong đợi:**

```
Fetching covers for 4 books...
1. Clean Code (978-0-13-468599-1) → ✅ COVER FOUND - Updated in database
2. Design Patterns (978-0-20-163361-0) → ✅ COVER FOUND - Updated in database
3. Dune (978-0-44-124224-0) → ✅ COVER FOUND - Updated in database
4. The Pragmatic Programmer (978-0-13-595705-9) → ✅ COVER FOUND - Updated in database
```

### Script verify_covers.py

**Vị trí:** `Book_Store_BE/verify_covers.py`

**Chức năng:**

- Fetch danh sách sách từ `/api/books/`
- Display tất cả sách với `official_cover_url` + `image_source` + `image_status`
- Verify mỗi URL có valid và accessible

**Cách chạy:**

```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests > /dev/null 2>&1 && python verify_covers.py"
```

### Danh sách 4 Sách Demo (9/1/2025)

| ID  | Tiêu đề                  | Tác giả                   | ISBN              | Official Cover URL                                 | Trạng thái |
| --- | ------------------------ | ------------------------- | ----------------- | -------------------------------------------------- | ---------- |
| 1   | Clean Code               | Robert C. Martin          | 978-0-13-468599-1 | https://covers.openlibrary.org/b/id/15126503-L.jpg | ✅ READY   |
| 2   | Design Patterns          | Gang of Four              | 978-0-20-163361-0 | https://covers.openlibrary.org/b/id/10827044-L.jpg | ✅ READY   |
| 3   | Dune                     | Frank Herbert             | 978-0-44-124224-0 | https://covers.openlibrary.org/b/id/14856017-L.jpg | ✅ READY   |
| 4   | The Pragmatic Programmer | David Thomas, Andrew Hunt | 978-0-13-595705-9 | https://covers.openlibrary.org/b/id/10143650-L.jpg | ✅ READY   |

**Xác minh:** Tất cả 4 sách hiện có `image_source = OFFICIAL` và `image_status = READY` trong database.

### Alternative: image-service Celery Worker

Dự án cũng có `image-service` (port 8012) sử dụng **Celery + Redis** để xử lý ảnh theo background job. Khi một sách được tạo:

1. Book-service trigger event `book.created`
2. Image-service Celery worker nhận event
3. Worker tìm cover từ Open Library API (tương tự `fetch_covers.py`)
4. Nếu không tìm, fallback sang DALL-E 3 AI generation
5. Upload ảnh, resize, lưu URL vào database

_Hiện tại: Các Celery workers chưa hoạt động trong Docker Compose (resource constraints). `fetch_covers.py` là interim solution để populate 4 sách demo._

---

## 14. Các Test Scripts Mới (Testing Session 9/1/2025)

| File               | Mục đích                                                                         | Kết quả      |
| ------------------ | -------------------------------------------------------------------------------- | ------------ |
| `test_phase1.py`   | Test JWT authentication (register, login, protected endpoints)                   | ✅ PASSED    |
| `test_rabbitmq.py` | Test RabbitMQ infrastructure (event publishing, queue binding)                   | ✅ PASSED    |
| `test_phase3.py`   | Test Saga state transitions (order flow: PENDING → PAYMENT_RESERVED → CONFIRMED) | ✅ PASSED    |
| `test_phase4.py`   | Test end-to-end happy path (complete order flow)                                 | ✅ PASSED    |
| `test_phase5.py`   | Test compensation flows (order cancellation, refund scenarios)                   | ✅ PASSED    |
| `test_phase6.py`   | Test resilience (health checks, circuit breaker, timeouts, metrics)              | ✅ PASSED    |
| `fetch_covers.py`  | Fetch book covers from Open Library API, update database (NEW)                   | ✅ COMPLETED |
| `verify_covers.py` | Verify all book covers populated and accessible (NEW)                            | ✅ VERIFIED  |

**Test Summary:** All phases (0-6) ✅ PASSED. Infrastructure stable, Saga orchestration working end-to-end, book covers successfully populated.

---

## 15. Troubleshooting & Common Issues

### Issue: `/api/books` trả về null official_cover_url & ai_image_url

**Root Cause:**

- Celery workers không hoạt động (resource constraints hoặc setup incomplete)
- Books seeded đã có `image_status = READY` nhưng không có actual URL data
- Image-service worker chưa process

**Giải pháp:**

1. Chạy `fetch_covers.py` để populate official cover URLs từ Open Library API
2. Hoặc start `image-service-worker` container để let Celery handle background
3. Verify bằng `verify_covers.py`

### Issue: RabbitMQ Connection Refused

**Root Cause:**

- Containers chưa khởi động hoàn toàn
- Docker network chưa setup
- Firewall blocking port 5672

**Giải pháp:**

1. `docker ps` → verify `rabbitmq` container running
2. `docker network ls` → verify `book_store_be_default` network exists
3. Wait 30-60s sau khi `docker-compose up`
4. Check RabbitMQ logs: `docker logs book_store_be_rabbitmq`

### Issue: Containers crash, exit code 1

**Root Cause:**

- Database migration failed
- Required env vars missing
- Port already in use
- CRLF line endings on shell scripts (Windows issue)

**Giải pháp:**

1. Check logs: `docker logs <container_name>`
2. Ensure `.sh` files have LF line endings: `dos2unix *.sh` (Linux/Mac) hoặc dùng VS Code
3. Delete old volumes: `docker-compose down -v && docker-compose up -d --build`
4. Check port conflicts: `netstat -ano | findstr <PORT>` (Windows PowerShell)

---

## 16. Production Readiness

**Hiện tại (9/1/2025):**

- ✅ Tất cả 6 phases đã hoàn thành
- ✅ Microservices architecture stable
- ✅ Event-driven Saga pattern working
- ✅ Compensation & resilience tested
- ✅ Book covers populated from Open Library
- ⚠️ Security hardening còn todo (remove hardcoded secrets, add rate limiting)
- ⚠️ Schema versioning chưa implement

**Để đưa vào production:**

1. Replace hardcoded JWT secret với env var từ secret manager
2. Setup centralized logging (ELK stack, Datadog)
3. Implement API rate limiting
4. Add GraphQL layer (optional, để optimize FE queries)
5. Kubernetes deployment (từ Docker Compose)
6. Load testing & performance tuning

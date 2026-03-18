# Phase 6 — Resilience & Observability: Hướng dẫn Test

## Các file đã thay đổi/tạo mới

| Service | File | Thay đổi |
|---|---|---|
| `api-gateway` | `app/circuit_breaker.py` | **MỚI** — Circuit breaker CLOSED/OPEN/HALF_OPEN |
| `api-gateway` | `app/views.py` | Tích hợp circuit breaker, structured logging, thêm `health_check()`, `metrics_view()` |
| `api-gateway` | `app/middleware.py` | Exempt `/api/health/` và `/api/metrics/` khỏi JWT |
| `api-gateway` | `api_gateway/urls.py` | Thêm `/api/health/` và `/api/metrics/` |
| `api-gateway` | `requirements.txt` | Thêm `prometheus-client` |
| `order-service` | `app/events.py` | Retry publish RabbitMQ 3 lần với backoff |
| `order-service` | `app/saga_orchestrator.py` | Structured logging với saga_id/correlation_id |
| `order-service` | `app/views.py` | Thêm `health_check()`, `metrics_view()` |
| `order-service` | `app/urls.py` | Thêm `/health/`, `/metrics/` |
| `order-service` | `app/management/commands/run_consumer.py` | Structured logging, reconnect loop |
| `pay-service` | `app/views.py` | Thêm `health_check()`, `metrics_view()` |
| `pay-service` | `app/urls.py` | Thêm `/health/`, `/metrics/` |
| `pay-service` | `app/management/commands/run_consumer.py` | Structured logging, reconnect loop |
| `ship-service` | `app/views.py` | Thêm `health_check()`, `metrics_view()` |
| `ship-service` | `app/urls.py` | Thêm `/health/`, `/metrics/` |
| `ship-service` | `app/management/commands/run_consumer.py` | Structured logging, reconnect loop |

---

## Điều kiện tiên quyết

1. Docker Desktop đang chạy, cấp ≥ 6GB RAM.
2. Rebuild toàn bộ (quan trọng!):

```bash
docker-compose up -d --build
```

---

## Chạy Test Tự Động

```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests > /dev/null 2>&1 && python test_phase6.py"
```

### Kết quả mong đợi
```
=== 1. Health Check Endpoints ===
  [PASS] /api/health/ returns 200
  [PASS] /api/health/ has status=ok
  [PASS] order-service /health/ returns 200
  [PASS] pay-service /health/ returns 200
  [PASS] ship-service /health/ returns 200

=== 2. /api/health/ accessible without JWT ===
  [PASS] /api/health/ returns 200 without JWT
  [PASS] response is not 401

=== 3. Metrics Endpoints ===
  [PASS] /api/metrics/ returns 200
  [PASS] /api/metrics/ has Prometheus format
  [PASS] order-service /metrics/ returns 200
  [PASS] order-service /metrics/ has Prometheus format
  [PASS] pay-service /metrics/ returns 200
  [PASS] ship-service /metrics/ returns 200

=== 4. Saga Happy Path (regression) ===
  [PASS] register
  [PASS] login
  [PASS] create order
  ... waiting for Saga to complete (up to 15s) ...
  [PASS] order reaches CONFIRMED

=== ALL PHASE 6 TESTS PASSED ===
```

---

## Test Thủ Công

### Health Check
```bash
# Qua gateway (không cần JWT)
curl http://localhost:8000/api/health/
# {"status": "ok", "service": "api-gateway"}

# Từng service trực tiếp
curl http://localhost:8005/health/   # order-service
curl http://localhost:8006/health/   # pay-service
curl http://localhost:8007/health/   # ship-service
```

### Metrics (Prometheus format)
```bash
curl http://localhost:8000/api/metrics/
# HELP gateway_requests_total ...
# TYPE gateway_requests_total counter
# gateway_requests_total 42

curl http://localhost:8005/metrics/
# order_total 3
# order_status_count{status="CONFIRMED"} 2
```

### Structured Logs (consumers)
```bash
docker-compose logs order-consumer --tail=20
# Mỗi event log sẽ có dạng:
# event_type=payment.reserve.completed saga_id=xxx correlation_id=yyy

docker-compose logs pay-consumer --tail=20
docker-compose logs ship-consumer --tail=20
```

### Circuit Breaker Test
```bash
# 1. Tắt book-service
docker-compose stop book-service

# 2. Gọi /api/books/ nhiều lần (5 lần → circuit OPEN)
for i in {1..6}; do curl -s http://localhost:8000/api/books/ | python3 -m json.tool; done

# 3. Sau khi circuit OPEN, response ngay lập tức:
# {"error": "Service book-service is temporarily unavailable (circuit open)"}

# 4. Bật lại
docker-compose start book-service
```

### Regression: Phase 5 vẫn hoạt động
```bash
docker run --rm --network book_store_be_default \
  -v $(pwd):/app -w /app python:3.11-slim \
  bash -c "pip install requests pika > /dev/null 2>&1 && python test_phase5.py"
```

---

## Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| `/health/` trả 404 | Chưa rebuild Docker image. Chạy `docker-compose up -d --build` |
| `/metrics/` không có `# HELP` | Bạn đang gọi vào URL cũ (trước Phase 6). Cần rebuild |
| Circuit breaker không mở | Cần ít nhất 5 lần lỗi liên tiếp vào cùng 1 service |
| Consumer crash-loop | Chạy `docker-compose logs pay-consumer --tail=20` để xem lý do |

# Hướng dẫn Kiểm tra Phase 1 (JWT Authentication)

Phase 1 đã hoàn tất việc bảo mật các endpoint thông qua **JWT Authentication Middleware** tại `api-gateway`. Đồng thời `customer-service` hiện đã hỗ trợ cấp phát token khi người dùng đăng nhập.

Dưới đây là cách bạn có thể tự kiểm tra (có thể dùng terminal hoặc trình test API như Postman/Insomnia):

### Môi trường
- Đảm bảo bạn đã chạy: `docker-compose up -d --build api-gateway customer-service`
- API Gateway vẫn chạy ở port `8000`.

### 1. Đăng ký tài khoản (Public API)
Đăng ký một người dùng mới thông qua Gateway (endpoint sẽ không bị block):
```bash
curl -X POST http://localhost:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testjwt1",
    "email": "testjwt1@example.com",
    "password": "password123",
    "phone": "555-1234"
  }'
```

### 2. Kiểm tra truy cập trái phép (Bị Blocked - 401)
Cố gắng tạo một giỏ hàng mà không truyền Token:
```bash
curl -i -X POST http://localhost:8000/api/carts/ \
  -H "Content-Type: application/json" \
  -d '{"customer_id": <ID_TỪ_BƯỚC_1>}'
```
**Kỳ vọng:** Trả về mã lỗi HTTP `401 Unauthorized` và message `{"error": "Unauthorized: Bearer token is required"}`.

### 3. Lấy JWT Token bằng cách Đăng nhập (Public API)
Thực hiện login bằng thông tin đã tạo ở bước 1:
```bash
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testjwt1@example.com",
    "password": "password123"
  }'
```
**Kỳ vọng:** Trả về thông tin khách hàng kèm theo chuỗi `"token": "eyJhbGciOiJIUzI1..."`.

### 4. Truy cập với JWT Token hợp lệ (Thành công - 200/201)
Tạo giỏ hàng và đính kèm JWT Token vào Header `Authorization`:
```bash
curl -X POST http://localhost:8000/api/carts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_TỪ_BƯỚC_3>" \
  -d '{"customer_id": <ID_TỪ_BƯỚC_1>}'
```
**Kỳ vọng:** Trả về mã HTTP `201 Created` và thông tin giỏ hàng được tạo thành công!

---
Script kiểm tra tự động toàn bộ luồng trên cũng đã được tạo tại `test_jwt.sh`. Bạn có thể chạy nhanh bằng lệnh `./test_jwt.sh` tại thư mục root của Backend.

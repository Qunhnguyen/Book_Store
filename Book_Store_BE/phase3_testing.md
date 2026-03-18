# Hướng dẫn Kiểm tra Phase 3 (Saga Orchestration)

Trong Phase 3, `order-service` đã được nâng cấp thành Saga Orchestrator. Nghĩa là ngoài việc xử lý API, hệ thống còn chạy thêm 1 worker ngầm (`order-consumer`) để hứng các Message từ RabbitMQ và tự động cập nhật trạng thái đơn hàng.

Quy trình State Machine của hệ thống như sau:
1. `PENDING`: Đơn hàng vừa Khởi tạo.
2. `payment.reserve.completed` => Order chuyển thành `PAYMENT_RESERVED`.
3. `shipping.reserve.completed` => Order chuyển thành `CONFIRMED`.

Vì hiện tại chưa có Consumers thật từ `pay-service` và `ship-service`, em đã tạo script test có khả năng "đóng giả" các services này.

### Cách Kiểm Tra

Mở Terminal tại thư mục `Book_Store_BE` và chạy lệnh sau (chạy thông qua docker để có môi trường và các thư viện requests/pika test giao tiếp RabbitMQ):

```bash
docker run --rm --network book_store_be_default -v $(pwd):/app -w /app python:3.11-slim bash -c "pip install requests pika > /dev/null 2>&1 && python test_phase3.py"
```

### Kết quả mong đợi trên màn hình:
1. **Register & Login** -> Thành công, lấy JWT.
2. **Create Order** -> Thành công. Log báo: `Order created: ID=X, Status=PENDING, SagaID=...`.
3. Khi script tự động bắn Message giả lập Payment Success (`payment.reserve.completed`) vào RabbitMQ. Ngay lập tức `order-consumer` bắt được và đổi status. Log check lại báo: `Order Status after Payment: PAYMENT_RESERVED`.
4. Script bắn tiếp Message giả lập Shipping Success (`shipping.reserve.completed`). Log sẽ báo: `Order Status after Shipping: CONFIRMED`.

Mọi thay đổi đều được vận hành trơn tru và hoàn toàn tự động!

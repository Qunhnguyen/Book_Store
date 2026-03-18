# Hướng dẫn Kiểm tra Phase 2 (RabbitMQ Infrastructure)

Phase 2 đã hoàn thiện phần xây dựng kiến trúc Event-Driven đầu tiên với **RabbitMQ**. Service `order-service` giờ đây thay vì gọi HTTP đồng bộ để thông báo cho `pay-service` và `ship-service` thì sẽ phát hành thông điệp (publish_event) vào RabbitMQ và ghi nhận trạng thái đơn hàng là `PENDING`.

Bạn có thể dễ dàng kiểm tra hệ thống theo các bước sau:

### 1. Truy cập Management UI của RabbitMQ
RabbitMQ đã được cấu hình với cổng Management để dễ dàng quản trị giao diện.
- Trình duyệt mở: `http://localhost:15672/`
- Username: `guest`
- Password: `guest`
- Bạn sẽ thấy Exchange tên là `bookstore.topic` vừa được `order-service` tự động tạo ra.

### 2. Thực hiện Test Flow tự động
Chạy script tự động gửi Request Checkout:
```bash
./test_rabbitmq.sh
```

### 3. Phân tích kết quả Script
Script trên sẽ:
1. Đăng ký tài khoản và Login lấy Token.
2. Thêm mặt hàng số 1 vào giỏ hàng.
3. Tạo Order (Checkout).
4. Order lúc này sẽ trả về `"status": "PENDING"`.
5. Script tự động truy vấn vào Management UI của RabbitMQ bằng API. Tuy nhiên vì hiện tại **Phase 4 (Saga Consumers)** chưa được thực hiện, nên message phát hành ra không có bất kỳ Queue (hàng đợi) nào hứng lấy. Do tính chất của Topic Exchanges, nó sẽ "drop" message nếu không có hàng đợi đăng ký nhận.

Điều này chứng tỏ RabbitMQ Broker đã hoạt động mượt mà và Server không còn bị dồn ứ bởi lỗi HTTP Request chặn luồng chờ. Khi Phase 4 khởi tạo Queue cho pay/ship-service, luồng sự kiện sẽ được hứng hoàn chỉnh.

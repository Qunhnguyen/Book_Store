Bạn là senior software architect và senior backend engineer. Hãy nâng cấp dự án Book_Store-main hiện tại từ microservices gọi REST đồng bộ thành kiến trúc có:

1. API Gateway + JWT
2. Database riêng cho từng service
3. Saga Pattern orchestration
4. Event Bus
5. Subscribers cho payment và shipping
6. Compensation logic
7. Resilience cơ bản
8. Observability cơ bản

Bối cảnh hiện tại của dự án:
- Dự án đã có các service: api-gateway, customer-service, order-service, pay-service, ship-service, book-service, cart-service, image-service
- Hiện tại các service chủ yếu gọi nhau bằng HTTP đồng bộ qua requests
- Nhiều service đang dùng SQLite
- Chưa có JWT thực sự
- Chưa có Saga đúng nghĩa
- Chưa có Event Bus cho order/payment/shipping
- Chưa có subscriber event-driven
- Chưa có compensation workflow đầy đủ
- Chưa có database-per-service đúng chuẩn production

Workflow mục tiêu bắt buộc phải đạt:
- Client gửi POST /orders
- API Gateway chặn request, xác thực JWT
- Nếu JWT hợp lệ, request được route xuống order-service
- order-service khởi động Saga
- order-service tạo Order ở trạng thái PENDING
- order-service publish event lên Event Bus
- pay-service và ship-service subscribe event
- mỗi service thực hiện local transaction riêng
- mỗi service publish kết quả ngược lại lên Event Bus
- order-service nhận kết quả để quyết định confirm hoặc compensate
- nếu có lỗi thì trạng thái cuối phải nhất quán

Yêu cầu triển khai:
1. Không phá vỡ cấu trúc hiện tại nếu không cần thiết
2. Ưu tiên RabbitMQ nếu cần chọn broker
3. Mỗi service phải có database riêng, ưu tiên PostgreSQL
4. Sửa code trực tiếp vào các service hiện có
5. Cập nhật docker-compose để chạy toàn bộ hệ thống
6. Thiết kế event contract rõ ràng, versionable
7. Dùng biến môi trường cho secret/config
8. Nếu cần thêm thư viện, cập nhật requirements tương ứng
9. Giữ backward compatibility ở mức hợp lý
10. Bổ sung hướng dẫn chạy thử end-to-end

Yêu cầu về Saga:
- Order status tối thiểu:
  PENDING, PAYMENT_RESERVED, SHIPPING_RESERVED, CONFIRMED, CANCELLED, COMPENSATING
- Có saga_id / correlation_id
- Có event names rõ ràng
- Nếu payment fail hoặc shipping fail thì phải chạy compensation phù hợp
- Tránh duplicate handling bằng idempotency key hoặc event tracking đơn giản

Yêu cầu về JWT:
- customer-service phát hành JWT khi login thành công
- API Gateway verify JWT ở các route cần bảo vệ, đặc biệt POST /orders
- Gateway forward customer identity qua internal headers
- Secret và expiry lấy từ env

Yêu cầu về Database:
- Chuyển từ SQLite sang PostgreSQL
- Mỗi service có database riêng
- Cập nhật settings, env, docker-compose
- Viết migration strategy tối thiểu
- Nếu cần seed data/dev bootstrap thì bổ sung script phù hợp

Yêu cầu về Resilience:
- Thêm timeout nhất quán
- Thêm retry cho thao tác phù hợp
- Thêm circuit breaker tối thiểu cho downstream dễ lỗi
- Không retry bừa bãi với non-idempotent action

Yêu cầu về Observability:
- Thêm /health hoặc /healthz cho các service chính
- Thêm /metrics cơ bản theo Prometheus format nếu hợp lý
- Logging có correlation_id / saga_id
- Log các event publish/consume quan trọng

Cách làm việc bắt buộc:
- Chia công việc thành nhiều phase nhỏ
- Ở mỗi phase:
  1. nêu mục tiêu
  2. liệt kê file cần sửa
  3. giải thích ngắn thiết kế
  4. đưa patch/code cụ thể
  5. nêu cách test phase đó
- Không nhảy vào sửa tất cả cùng lúc
- Bắt đầu từ Phase 0 trước

Phase mong muốn:
- Phase 0: Chuyển sang PostgreSQL và database riêng cho từng service
- Phase 1: JWT issuance + JWT verification ở API Gateway
- Phase 2: RabbitMQ + event infrastructure + event schema
- Phase 3: Saga orchestration trong order-service
- Phase 4: Subscribers trong pay-service và ship-service
- Phase 5: Compensation workflow + trạng thái cuối
- Phase 6: Resilience + observability + test end-to-end

Đầu ra mong muốn:
- Trước tiên, hãy đánh giá nhanh cấu trúc hiện tại và xác nhận các điểm còn thiếu
- Sau đó chỉ thực hiện Phase 0
- Chỉ rõ chính xác file nào cần tạo/sửa
- Cung cấp code hoàn chỉnh cho từng file bị thay đổi
- Cuối cùng đưa checklist test cho Phase 0

Hãy thực hiện Phase 0 cho dự án Book_Store-main.

Mục tiêu:
- chuyển các service chính từ SQLite sang PostgreSQL
- mỗi service có database riêng
- cập nhật docker-compose để chạy được toàn bộ môi trường dev
- dùng biến môi trường cho DB config
- giữ migration của từng service độc lập

Phạm vi tối thiểu:
- customer-service
- order-service
- pay-service
- ship-service
- book-service
- cart-service
- có thể giữ image-service theo cấu hình hiện tại nếu chưa cần, nhưng ưu tiên đồng bộ nếu khả thi

Yêu cầu:
1. Phân tích nhanh các file settings/database hiện tại của từng service
2. Liệt kê chính xác file cần sửa/tạo
3. Chuyển cấu hình DB sang env:
   - DB_NAME
   - DB_USER
   - DB_PASSWORD
   - DB_HOST
   - DB_PORT
4. Dùng PostgreSQL
5. Mỗi service có database riêng
6. Cập nhật docker-compose:
   - thêm postgres
   - tạo nhiều database hoặc hướng dẫn init script
7. Nếu cần thêm thư viện, cập nhật requirements
8. Không làm JWT/RabbitMQ/Saga ở phase này
9. Cần có hướng dẫn migrate cho từng service
10. Nếu dữ liệu seed đang cần cho demo, bổ sung cách seed lại

Đầu ra:
- Tóm tắt thiết kế ngắn
- Danh sách file cần sửa
- Code hoàn chỉnh cho từng file thay đổi
- docker-compose cập nhật
- script init database nếu cần
- checklist test phase 0
 
 Hãy thực hiện Phase 1 cho dự án Book_Store-main.

Mục tiêu:
- customer-service phát hành JWT khi login thành công
- api-gateway verify JWT cho các route cần bảo vệ, đặc biệt POST /orders
- gateway forward customer identity xuống downstream qua internal headers
- dùng env cho JWT secret và expiry

Bối cảnh hiện tại:
- customer-service hiện login nhưng chưa trả JWT thật
- api-gateway hiện chỉ forward request, chưa verify token
- dự án là Django-based microservices

Yêu cầu:
1. Phân tích nhanh file hiện có liên quan tới login, gateway routing, config
2. Liệt kê chính xác file cần sửa/tạo
3. Viết code hoàn chỉnh cho từng file bị đổi
4. Nếu cần thư viện JWT, cập nhật requirements
5. Thêm ví dụ request/response login
6. Thêm ví dụ gọi POST /orders qua gateway với Authorization: Bearer <token>
7. Không làm sang RabbitMQ/Saga ở phase này

Đầu ra:
- Tóm tắt thiết kế ngắn
- Patch theo từng file
- Checklist test phase 1

Hãy thực hiện Phase 2 cho dự án Book_Store-main.

Mục tiêu:
- thêm RabbitMQ vào docker-compose
- tạo hạ tầng publish/consume event dùng RabbitMQ
- định nghĩa event schema chuẩn cho Saga order-payment-shipping
- order-service có thể publish event ban đầu sau khi tạo order PENDING

Yêu cầu:
1. Ưu tiên RabbitMQ
2. Tạo cấu trúc code dùng lại được cho event publishing
3. Dùng JSON message với metadata:
   - event_id
   - event_type
   - event_version
   - saga_id
   - correlation_id
   - timestamp
   - payload
4. Cập nhật env/config cho các service liên quan
5. Chưa cần hoàn thiện compensation ở phase này
6. Chỉ cần bảo đảm order-service publish được event đầu tiên

Đầu ra:
- Thiết kế exchange/queue/routing key
- File cần sửa/tạo
- Code hoàn chỉnh
- Cách chạy RabbitMQ và test publish event

Hãy thực hiện Phase 3 cho dự án Book_Store-main.

Mục tiêu:
- order-service đóng vai trò Saga orchestrator
- khi nhận POST /orders, order-service tạo Order ở trạng thái PENDING
- order-service publish các event cần thiết để reserve payment và reserve shipping
- order-service theo dõi tiến trình saga bằng saga_id/correlation_id
- cập nhật trạng thái order theo kết quả event

Yêu cầu:
1. Thiết kế state machine rõ ràng cho order saga
2. Đề xuất model/table nếu cần để lưu saga state hoặc event processing state
3. Đảm bảo idempotency tối thiểu cho event handling
4. Tách logic orchestration khỏi view nếu có thể
5. Chưa cần triển khai subscriber đầy đủ ở pay-service/ship-service trong phase này, nhưng cần chuẩn bị contract

Đầu ra:
- State machine
- File cần sửa/tạo
- Code hoàn chỉnh
- Checklist test phase 3

Hãy thực hiện Phase 4 cho dự án Book_Store-main.

Mục tiêu:
- pay-service subscribe event reserve payment
- ship-service subscribe event reserve shipping
- mỗi service thực hiện local transaction riêng
- publish event kết quả thành công/thất bại ngược lại cho Saga

Yêu cầu:
1. pay-service xử lý:
   - payment.reserve.requested
   - payment.compensate.requested
2. ship-service xử lý:
   - shipping.reserve.requested
   - shipping.compensate.requested
3. Mỗi service phải publish result event tương ứng
4. Cần có idempotent consumer tối thiểu
5. Dùng logging có correlation_id / saga_id
6. Không gọi REST đồng bộ thay cho event nếu không bắt buộc

Đầu ra:
- Consumer flow cho từng service
- File sửa/tạo
- Code hoàn chỉnh
- Checklist test phase 4

Hãy thực hiện Phase 5 cho dự án Book_Store-main.

Mục tiêu:
- hoàn thiện compensation khi payment hoặc shipping thất bại
- order-service quyết định confirm hoặc compensate
- trạng thái order cuối cùng phải nhất quán

Yêu cầu:
1. Nếu payment fail:
   - order-service chuyển sang compensating/cancelled hợp lý
2. Nếu shipping fail sau khi payment đã reserved:
   - phải phát compensation cho payment
3. Nếu payment đã reserved và shipping reserved đều thành công:
   - confirm order
4. Định nghĩa rõ final states:
   - CONFIRMED
   - CANCELLED
5. Bảo đảm không confirm trùng, không compensate trùng

Đầu ra:
- Decision matrix
- File sửa/tạo
- Code hoàn chỉnh
- Checklist test compensation

Hãy thực hiện Phase 6 cho dự án Book_Store-main.

Mục tiêu:
- bổ sung resilience và observability cơ bản cho toàn hệ thống

Yêu cầu về resilience:
1. timeout nhất quán cho HTTP nội bộ
2. retry hợp lý cho thao tác idempotent hoặc broker reconnect
3. circuit breaker tối thiểu cho downstream HTTP calls dễ lỗi

Yêu cầu về observability:
1. thêm /health hoặc /healthz cho api-gateway, order-service, pay-service, ship-service
2. thêm /metrics cơ bản theo Prometheus nếu phù hợp
3. logging có correlation_id / saga_id
4. log event publish/consume
5. mô tả cách gom log tập trung nếu chưa tích hợp full stack

Đầu ra:
- Thiết kế ngắn
- File sửa/tạo
- Code hoàn chỉnh
- Cách test resilience/observability
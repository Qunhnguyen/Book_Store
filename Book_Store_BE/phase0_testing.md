# Hướng dẫn Kiểm tra Phase 0 (PostgreSQL Migration)

Phase 0 đã hoàn tất việc cấu hình đổi từ `SQLite` sang `PostgreSQL` cho toàn bộ các Microservices. Dưới đây là các bước để anh tự kiểm thử và đảm bảo hệ thống đã hoạt động trơn tru với PostgreSQL trước khi bước sang Phase 1.

## Bước 1: Dọn dẹp môi trường cũ & Build lại
Vì chúng ta đã thêm dependencies mới (`psycopg2-binary`) vào `requirements.txt` và thêm service db mới, anh cần clear volume cũ và build lại các images:

```bash
cd /Users/dongocminh/PTTK/ass05_06/Book_Store_BE
docker-compose down -v
docker-compose build
```

## Bước 2: Khởi chạy môi trường
Khởi chạy toàn bộ hệ thống bằng lệnh:

```bash
docker-compose up -d
```
> [!NOTE]
> Khi khởi chạy, container `postgres` sẽ chạy script `postgres-init.sh` để tự động tạo ra mười mấy database riêng biệt như `customer_db`, `book_db`, `order_db`, `pay_db`...
> Các container microservices (như `book-service`, `order-service`,...) cũng tự động chạy lệnh `python manage.py migrate` lúc khởi động theo như `Dockerfile` đã định nghĩa.

## Bước 3: Seed Dữ liệu Sách
Sau khi các services đã lên và kết nối với PostgreSQL Database thành công, hãy nạp một lượng sách mẫu vào Database để có thể test UI:

```bash
docker-compose exec book-service python manage.py shell -c "import sys; sys.path.insert(0, '/app'); exec(open('../seed_books.py').read())"
```
*(Nếu gặp lỗi đường dẫn khi seed, anh có thể vào shell của container `book-service` và gõ `python ../seed_books.py`)*

## Bước 4: Kiểm tra sự tồn tại của Database
Để biết chắc chắn các tables đã được tạo trong Database PostgreSQL, anh có thể kết nối vào DB bằng lệnh sau (Password là postgres):

```bash
docker-compose exec postgres psql -U postgres -d book_db -c "\dt"
```
*Lệnh này sẽ liệt kê tất cả các tables bên trong DB của Book Service.*

## Bước 5: Kiểm tra Flow mua hàng cơ bản (E2E)
Hệ thống hiện tại vẫn dùng phương thức gọi đồng bộ (Synchronous HTTP) như thiết kế ban đầu. Hãy test xem việc giao tiếp với PostgreSQL có lỗi gì không:

1. Dùng trình duyệt mở API Gateway: `http://localhost:8000/books-ui/`
2. Tạo thử một Customer ở `http://localhost:8000/customers-ui/`
3. Sẽ được gán `customer_id`.
4. Tìm đến `http://localhost:8000/cart-ui/<customer_id>/` để xem/giỏ hàng.
5. Cuối cùng, tạo Order để xem các service `order`, `book`, `pay`, `ship` có cùng gọi nhau và lưu vào DB PostgreSQL không!

---

💡 **Sau khi anh test thành công mọi luồng với database mới (PostgreSQL), hãy nhắn tin lại cho em để em bắt đầu Phase 1 (Tích hợp JWT Auth)!**

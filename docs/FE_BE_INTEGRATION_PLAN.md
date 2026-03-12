FE - BE Integration Guide (Book Store)
1) Muc tieu
Tai lieu nay huong dan team Frontend ket noi vao Backend thong qua API Gateway duy nhat.

Gateway base URL: http://localhost:8000
Tat ca API FE nen goi qua Gateway: /api/...
Khong goi truc tiep cac service 8001..8011 tu FE
2) Kien truc call
Frontend -> API Gateway (port 8000) -> Microservices noi bo

Gateway route da khai bao tai:

api-gateway/api_gateway/urls.py
api-gateway/app/views.py
3) Cai dat moi truong de FE chay
Chay backend:
docker compose up --build
Health check nhanh:
curl http://localhost:8000/api/books/
Neu tra ve JSON list (co the rong []) la thong.

4) Quy uoc chung cho FE
Header cho POST/PUT:
Content-Type: application/json
Accept: application/json
Dinh dang body: JSON
Gateway dang proxy request, status code tu service se duoc giu nguyen
5) Danh sach API Gateway cho FE
5.1 Books
GET /api/books/ - Lay danh sach sach
POST /api/books/ - Tao sach
PUT /api/books/{book_id}/ - Cap nhat sach
DELETE /api/books/{book_id}/ - Xoa sach
Body tao/cap nhat sach:

{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": "120000.00",
  "stock": 10
}
5.2 Customers (Auth)
POST /api/register/ - Đăng ký tài khoản mới
POST /api/login/ - Đăng nhập tài khoản
GET /api/customers/ - Lấy danh sách khách hàng
Body đăng ký (POST /api/register/):

{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "mysecretpassword"
}
Kết quả trả về HTTP 201 Created kèm thông tin user vừa tạo (không bao gồm password). Lưu ý: Service customer sẽ gọi sang cart-service để tạo cart mặc định. Nếu cart-service lỗi, customer có thể bị rollback và trả về lỗi 503.

Body đăng nhập (POST /api/login/):

{
  "email": "a@example.com",
  "password": "mysecretpassword"
}
Kết quả trả về nếu đúng tài khoản hợp lệ (HTTP 200 OK):

{
  "message": "Login successful",
  "customer_id": 1,
  "name": "Nguyen Van A",
  "email": "a@example.com"
}
Quan trọng cho Frontend:

Frontend cần lưu giá trị customer_id từ kết quả đăng nhập (ví dụ lưu trong localStorage hoặc Redux/Context).
Các hành động tiếp theo của người dùng (như lấy giỏ hàng, tạo đơn hàng, v.v.) sẽ sử dụng customer_id này để gửi kèm trong request body hoặc URL.
5.3 Cart
POST /api/carts/ - Tao cart thu cong
GET /api/carts/{customer_id}/ - Lay item trong cart cua customer
POST /api/cart-items/ - Them item vao cart
PUT /api/cart-items/{item_id}/ - Sua so luong item
Body tao cart:

{
  "customer_id": 1
}
Body them cart item:

{
  "cart": 1,
  "book_id": 1,
  "quantity": 2
}
Quan trong:

Truong cart la cart_id, KHONG phai customer_id
5.4 Orders
GET /api/orders/ - Lay tat ca don
POST /api/orders/ - Tao don tu cart cua customer
GET /api/orders/{customer_id}/ - Lay don theo customer
Body tao order:

{
  "customer_id": 1
}
Luu y:

Neu cart rong -> loi 400
Khi tao order, he thong co gang tao payment + shipment tu dong
5.5 Payments
GET /api/payments/ - Lay tat ca payment
POST /api/payments/ - Tao payment
GET /api/payments/{order_id}/ - Lay payment theo order
Body tao payment:

{
  "order_id": 1,
  "payment_method": "COD"
}
Neu khong gui payment_method, backend default COD.

5.6 Shipments
GET /api/shipments/ - Lay tat ca shipment
POST /api/shipments/ - Tao shipment
GET /api/shipments/{order_id}/ - Lay shipment theo order
Body tao shipment:

{
  "order_id": 1,
  "shipping_method": "STANDARD",
  "address": "123 Nguyen Trai"
}
Neu khong gui shipping_method, backend default STANDARD.

5.7 Reviews
GET /api/reviews/ - Lay tat ca review
POST /api/reviews/ - Tao review
GET /api/reviews/book/{book_id}/ - Lay review theo sach
Body tao review:

{
  "customer_id": 1,
  "book_id": 1,
  "rating": 5,
  "comment": "Sach rat hay"
}
Rang buoc:

rating tu 1 den 5
5.8 Managers
GET /api/managers/
POST /api/managers/
Body tao manager:

{
  "name": "Manager 1",
  "email": "manager1@example.com"
}
5.9 Categories
GET /api/categories/
POST /api/categories/
Body tao category:

{
  "name": "Lap trinh"
}
5.10 Staff Books
GET /api/staff/books/
POST /api/staff/books/
PUT /api/staff/books/{book_id}/
DELETE /api/staff/books/{book_id}/
Body giong books API.

5.11 Recommendations
GET /api/recommendations/
Tra ve toi da 5 sach con hang.

6) Luong tich hop de FE implement
Nen di theo flow:

Đăng ký/Đăng nhập (nhấn nút Get Started để Đăng ký và Đăng nhập để nhận customer_id).
Luôn lưu lại customer_id ở FE để tái sử dụng.
Tao hoac lay danh sach books
Tao cart (neu can) va them cart-items bằng customer_id
Tao order bang customer_id
Hien thi payments + shipments theo order_id
Tao/xem reviews theo book_id
7) Vi du service file cho FE (axios)
// src/services/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000,
});

export const BooksApi = {
  list: () => api.get("/api/books/"),
  create: (payload: { title: string; author: string; price: string; stock: number }) =>
    api.post("/api/books/", payload),
  update: (id: number, payload: Partial<{ title: string; author: string; price: string; stock: number }>) =>
    api.put(`/api/books/${id}/`, payload),
  remove: (id: number) => api.delete(`/api/books/${id}/`),
};

export const AuthApi = {
  register: (payload: { name: string; email: string; password: string }) => api.post("/api/register/", payload),
  login: (payload: { email: string; password: string }) => api.post("/api/login/", payload),
};

export const CustomersApi = {
  list: () => api.get("/api/customers/"),
};

export const CartApi = {
  createCart: (customer_id: number) => api.post("/api/carts/", { customer_id }),
  listByCustomer: (customerId: number) => api.get(`/api/carts/${customerId}/`),
  addItem: (payload: { cart: number; book_id: number; quantity: number }) => api.post("/api/cart-items/", payload),
  updateItem: (itemId: number, payload: { quantity: number }) => api.put(`/api/cart-items/${itemId}/`, payload),
};

export const OrdersApi = {
  create: (customer_id: number) => api.post("/api/orders/", { customer_id }),
  listByCustomer: (customerId: number) => api.get(`/api/orders/${customerId}/`),
};

export const PaymentsApi = {
  listByOrder: (orderId: number) => api.get(`/api/payments/${orderId}/`),
};

export const ShipmentsApi = {
  listByOrder: (orderId: number) => api.get(`/api/shipments/${orderId}/`),
};

export const ReviewsApi = {
  listByBook: (bookId: number) => api.get(`/api/reviews/book/${bookId}/`),
  create: (payload: { customer_id: number; book_id: number; rating: number; comment?: string }) =>
    api.post("/api/reviews/", payload),
};
8) Error handling FE nen co
400: Du lieu dau vao sai (show message validation)
404: Khong tim thay resource (book/order...)
503: Service phia sau dang down/timeout
Goi y UI:

503: toast "He thong tam thoi gian doan, vui long thu lai"
400: hien thi message field error tu response
9) CORS va moi truong FE tach rieng
Neu FE chay khac origin (VD: http://localhost:5173) thi can cau hinh CORS tren gateway
Cach de phat trien nhanh:
Dung dev proxy cua Vite/Next de forward /api ve http://localhost:8000
Hoac bo sung CORS middleware trong gateway
10) Checklist truoc khi ban giao FE
 FE dung 1 base URL duy nhat: http://localhost:8000
 Tat ca API di qua /api/...
 Da xu ly error 400/404/503
 Da test flow tao customer -> cart -> order -> payment/shipment
 Da test review va recommendations
Neu can, co the tao them Postman Collection de FE/QA import va test regression nhanh.
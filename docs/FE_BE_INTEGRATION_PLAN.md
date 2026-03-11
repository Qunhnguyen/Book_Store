# FE-BE Integration Plan (Book Store)

## 1) Muc tieu
- Chuyen toan bo FE call API qua Gateway duy nhat: `/api/*` tren port/domain cua gateway.
- Giu giao dien hien tai, thay doi tang call API theo tung phase de tranh vo flow.
- Co checklist theo module de team lam lau van bam duoc dung huong.

## 2) Nguyen tac
- FE chi goi 1 base URL: `VITE_API_BASE_URL`.
- Moi endpoint FE dung format: `${VITE_API_BASE_URL}/api/...`.
- Khong goi truc tiep service 8001..8011 tu FE.
- Moi phase deu co: endpoint map, test case, rollback point.

## 3) Trang thai hien tai (da lam)
- Da doi config API tu nhieu bien service -> 1 bien gateway:
  - `frontend/src/api/client.js`
  - `frontend/.env.example`
  - `frontend/README.md`

## 4) Endpoint mapping chuan
- Books:
  - GET `/api/books/`
  - POST `/api/books/`
  - PUT `/api/books/{book_id}/`
  - DELETE `/api/books/{book_id}/`
- Customers:
  - GET `/api/customers/`
  - POST `/api/customers/`
- Cart:
  - POST `/api/carts/`
  - GET `/api/carts/{customer_id}/`
  - POST `/api/cart-items/`
  - PUT `/api/cart-items/{item_id}/`
- Orders:
  - GET `/api/orders/`
  - POST `/api/orders/`
  - GET `/api/orders/{customer_id}/`
- Payments:
  - GET `/api/payments/`
  - POST `/api/payments/`
  - GET `/api/payments/{order_id}/`
- Shipments:
  - GET `/api/shipments/`
  - POST `/api/shipments/`
  - GET `/api/shipments/{order_id}/`
- Reviews:
  - GET `/api/reviews/`
  - POST `/api/reviews/`
  - GET `/api/reviews/book/{book_id}/`
- Managers:
  - GET `/api/managers/`
  - POST `/api/managers/`
- Categories:
  - GET `/api/categories/`
  - POST `/api/categories/`
- Staff Books:
  - GET `/api/staff/books/`
  - POST `/api/staff/books/`
  - PUT `/api/staff/books/{book_id}/`
  - DELETE `/api/staff/books/{book_id}/`
- Recommendations:
  - GET `/api/recommendations/`

## 5) Ke hoach trien khai theo phase

### Phase 0 - Baseline va smoke test
- Muc tieu:
  - Xac nhan FE call qua gateway thong suot sau khi doi env.
- Viec can lam:
  - Tao `frontend/.env` tu `.env.example`.
  - Chay backend + FE, verify trang dashboard va 2-3 trang CRUD co data.
- Done khi:
  - Khong con request den 8001..8011 tren browser network.

### Phase 1 - Nhom Ops CRUD co ban (de, it phu thuoc)
- Scope man hinh:
  - `/ops/books`
  - `/ops/customers`
  - `/ops/categories`
  - `/ops/managers`
  - `/ops/staff`
  - `/ops/recommendations`
- Viec can lam:
  - Verify payload dung schema BE.
  - Chuan hoa xu ly loi (message ro rang khi 400/404/503).
- Done khi:
  - CRUD/Read hoat dong on dinh tren local gateway.

### Phase 2 - Cart flow (critical truoc Order)
- Scope man hinh:
  - `/ops/cart`
  - `/cart`
  - `/book/:id` (action add to cart)
- Viec can lam:
  - Dam bao dung `cart` = `cart_id` khi add item (khong dung customer_id).
  - Bo sung logic fallback tao cart neu customer chua co cart (`POST /api/carts/`).
  - Xac dinh rule quantity > 0, handle 400.
- Done khi:
  - Add/update cart item on dinh, khong bi sai id cart.

### Phase 3 - Order + Payment + Shipment flow
- Scope man hinh:
  - `/ops/orders`
  - `/ops/payments`
  - `/ops/shipments`
  - `/checkout`
- Viec can lam:
  - Tao order tu customer_id.
  - Sau tao order, uu tien doc payment/shipment theo order_id thay vi tao trung lap.
  - Chi tao payment/shipment bang tay khi order chua auto tao.
- Done khi:
  - Checkout tao don thanh cong, xem duoc payment/shipment theo order.

### Phase 4 - Reviews va profile
- Scope man hinh:
  - `/ops/reviews`
  - `/reviews-profile`
  - `/book/:id` (review section)
- Viec can lam:
  - Validate rating 1..5 truoc submit.
  - Dong bo du lieu review theo book_id/customer_id.
- Done khi:
  - Tao review + hien thi review dung theo sach va user.

### Phase 5 - Dashboard va tinh chinh
- Scope man hinh:
  - `/ops`
- Viec can lam:
  - Dung Promise.all co fallback rieng tung service de dashboard khong vo toan bo.
  - Hien thong bao dung service nao dang loi.
- Done khi:
  - Dashboard van hien mot phan so lieu neu 1 service loi.

### Phase 6 - Refactor tang API (de de bao tri lau dai)
- Muc tieu:
  - Tach endpoint ra thanh service module, tranh lap URL trong page.
- De xuat:
  - `src/api/services/booksApi.js`
  - `src/api/services/ordersApi.js`
  - ...
- Done khi:
  - Pages chi goi function service, khong tu ghep URL string nua.

## 6) Danh sach ui route -> backend dependency
- Public:
  - `/` -> books, recommendations, categories
  - `/book/:id` -> books, reviews(book), carts, cart-items
  - `/cart` -> books, carts, cart-items, orders
  - `/checkout` -> books, carts, orders, payments, shipments
  - `/reviews-profile` -> reviews, books
- Ops:
  - `/ops` -> books, customers, orders, reviews
  - `/ops/books` -> books
  - `/ops/customers` -> customers
  - `/ops/cart` -> carts, cart-items
  - `/ops/orders` -> orders
  - `/ops/payments` -> payments
  - `/ops/shipments` -> shipments
  - `/ops/reviews` -> reviews
  - `/ops/categories` -> categories
  - `/ops/managers` -> managers
  - `/ops/staff` -> staff/books
  - `/ops/recommendations` -> recommendations

## 7) Test checklist moi phase
- Kiem tra request URL bat dau bang `${VITE_API_BASE_URL}/api/`.
- Kiem tra trailing slash endpoint (`.../`).
- Kiem tra payload type so (`Number(...)`) cho id/rating/quantity.
- Kiem tra xu ly loi 400/404/503 va message hien thi.
- Kiem tra UI khong crash khi response rong (`[]`).

## 8) Risk chinh va cach giam rui ro
- Risk: Customer tao moi bi rollback neu cart-service loi.
  - Giam rui ro: hien message huong dan retry + log loi day du.
- Risk: Tao order xong tao payment/shipment trung lap.
  - Giam rui ro: doc payment/shipment theo order truoc, chi tao khi chua co.
- Risk: Depend nhieu service tren showcase pages.
  - Giam rui ro: fallback du lieu mau co kiem soat, nhung tach ro state demo va state production.

## 9) Definition of Done tong
- FE chay duoc voi local gateway (`http://localhost:8000`) va production domain chi can doi `VITE_API_BASE_URL`.
- Khong con hard-code port 8001..8011 trong source FE.
- Moi route chinh co smoke test pass theo checklist.
- Team co the tick checklist theo tung phase va tiep tuc khi task keo dai.

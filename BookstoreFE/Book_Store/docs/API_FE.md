# Book_Store API Documentation (for Frontend)

Tai lieu nay tong hop toan bo API hien co de lam lai frontend.
Nguon doc tu code trong cac service Django/DRF ngay 2026-03-09.

## 1) Base URL theo moi truong

Chay qua `docker-compose` (goi tu may local):

- API Gateway UI: `http://localhost:8000`
- Customer Service: `http://localhost:8001`
- Book Service: `http://localhost:8002`
- Cart Service: `http://localhost:8003`
- Staff Service: `http://localhost:8004`
- Order Service: `http://localhost:8005`
- Pay Service: `http://localhost:8006`
- Ship Service: `http://localhost:8007`
- Comment/Rate Service: `http://localhost:8008`
- Manager Service: `http://localhost:8009`
- Catalog Service: `http://localhost:8010`
- Recommender AI Service: `http://localhost:8011`

Luu y:
- Tat ca endpoint deu dung duoi dang co dau `/` cuoi path (vi du: `/books/`).
- Khong co auth token/JWT trong phien ban hien tai.

## 2) Data Models (response chinh)

### Book
```json
{
  "id": 1,
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": "19.99",
  "stock": 10
}
```

### Customer
```json
{
  "id": 1,
  "name": "Nguyen Van A",
  "email": "a@example.com"
}
```

### Cart
```json
{
  "id": 1,
  "customer_id": 1
}
```

### CartItem
```json
{
  "id": 1,
  "cart": 1,
  "book_id": 2,
  "quantity": 3
}
```

### Order
```json
{
  "id": 1,
  "customer_id": 1,
  "status": "CREATED"
}
```

### Payment
```json
{
  "id": 1,
  "order_id": 1,
  "payment_method": "COD",
  "status": "PENDING"
}
```

### Shipment
```json
{
  "id": 1,
  "order_id": 1,
  "shipping_method": "STANDARD",
  "address": "",
  "status": "PENDING"
}
```

### Review
```json
{
  "id": 1,
  "customer_id": 1,
  "book_id": 1,
  "rating": 5,
  "comment": "Rat hay"
}
```

### Category
```json
{
  "id": 1,
  "name": "Programming"
}
```

### Manager
```json
{
  "id": 1,
  "name": "Manager 1",
  "email": "manager@example.com"
}
```

## 3) API theo Service

## 3.1 Customer Service (`http://localhost:8001`)

### GET `/customers/`
- Mo ta: Lay danh sach khach hang.
- Response: `200 OK` + `Customer[]`

### POST `/customers/`
- Mo ta: Tao khach hang moi. Service se tu dong goi cart-service de tao cart cho customer nay.
- Body:
```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com"
}
```
- Success: `201 Created` + `Customer`
- Loi thuong gap:
  - `400 Bad Request`: email invalid/trung
  - `503 Service Unavailable`: khong tao duoc cart ben cart-service

## 3.2 Book Service (`http://localhost:8002`)

### GET `/books/`
- Mo ta: Lay danh sach sach.
- Response: `200 OK` + `Book[]`

### POST `/books/`
- Mo ta: Tao sach moi.
- Body:
```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": "19.99",
  "stock": 10
}
```
- Response: `201 Created` + `Book`

### PUT `/books/{book_id}/`
- Mo ta: Cap nhat mot phan hoac toan bo thong tin sach.
- Body (partial allowed):
```json
{
  "stock": 5
}
```
- Response: `200 OK` + `Book`

### DELETE `/books/{book_id}/`
- Mo ta: Xoa sach.
- Response: `204 No Content`

## 3.3 Cart Service (`http://localhost:8003`)

### POST `/carts/`
- Mo ta: Tao cart (thuong do customer-service goi).
- Body:
```json
{
  "customer_id": 1
}
```
- Response: `201 Created` + `Cart`

### POST `/cart-items/`
- Mo ta: Them sach vao gio.
- Body:
```json
{
  "cart": 1,
  "book_id": 2,
  "quantity": 3
}
```
- Success: `201 Created` + `CartItem`
- Loi:
  - `404 Not Found`: sach khong ton tai
  - `503 Service Unavailable`: khong reach duoc book-service

### PUT `/cart-items/{item_id}/`
- Mo ta: Cap nhat so luong item trong gio.
- Body:
```json
{
  "quantity": 2
}
```
- Response: `200 OK` + `CartItem`
- Loi: `400 Bad Request` neu `quantity <= 0`

### GET `/carts/{customer_id}/`
- Mo ta: Lay tat ca item trong gio cua customer.
- Response: `200 OK` + `CartItem[]`

## 3.4 Order Service (`http://localhost:8005`)

### GET `/orders/`
- Mo ta: Lay tat ca don hang.
- Response: `200 OK` + `Order[]`

### POST `/orders/`
- Mo ta: Tao don hang tu gio hang cua customer.
- Body:
```json
{
  "customer_id": 1
}
```
- Behavior:
  - Lay cart items tu cart-service
  - Tao `Order` + `OrderItem`
  - Tu dong goi pay-service tao payment (best effort)
  - Tu dong goi ship-service tao shipment (best effort)
- Success: `201 Created` + `Order`
- Loi:
  - `400 Bad Request`: thieu/sai `customer_id`, cart rong, khong co item hop le
  - `503 Service Unavailable`: khong reach duoc cart-service

### GET `/orders/{customer_id}/`
- Mo ta: Lay danh sach don cua 1 customer.
- Response: `200 OK` + `Order[]`

## 3.5 Pay Service (`http://localhost:8006`)

### GET `/payments/`
- Mo ta: Lay tat ca payment.
- Response: `200 OK` + `Payment[]`

### POST `/payments/`
- Mo ta: Tao payment cho order.
- Body:
```json
{
  "order_id": 1,
  "payment_method": "COD"
}
```
- Success: `201 Created` + `Payment` (status mac dinh `PENDING`)
- Loi:
  - `404 Not Found`: order khong ton tai
  - `503 Service Unavailable`: khong reach duoc order-service

### GET `/payments/{order_id}/`
- Mo ta: Lay payment theo order.
- Response: `200 OK` + `Payment[]`

## 3.6 Ship Service (`http://localhost:8007`)

### GET `/shipments/`
- Mo ta: Lay tat ca shipment.
- Response: `200 OK` + `Shipment[]`

### POST `/shipments/`
- Mo ta: Tao shipment cho order.
- Body:
```json
{
  "order_id": 1,
  "shipping_method": "STANDARD",
  "address": "123 Le Loi"
}
```
- Success: `201 Created` + `Shipment` (status mac dinh `PENDING`)
- Loi:
  - `404 Not Found`: order khong ton tai
  - `503 Service Unavailable`: khong reach duoc order-service

### GET `/shipments/{order_id}/`
- Mo ta: Lay shipment theo order.
- Response: `200 OK` + `Shipment[]`

## 3.7 Comment/Rate Service (`http://localhost:8008`)

### GET `/reviews/`
- Mo ta: Lay tat ca review.
- Response: `200 OK` + `Review[]`

### POST `/reviews/`
- Mo ta: Tao review cho sach.
- Body:
```json
{
  "customer_id": 1,
  "book_id": 2,
  "rating": 5,
  "comment": "Rat on"
}
```
- Success: `201 Created` + `Review`
- Loi:
  - `400 Bad Request`: `rating` ngoai [1..5]
  - `404 Not Found`: book khong ton tai
  - `503 Service Unavailable`: khong reach duoc book-service

### GET `/reviews/book/{book_id}/`
- Mo ta: Lay review theo sach.
- Response: `200 OK` + `Review[]`

## 3.8 Catalog Service (`http://localhost:8010`)

### GET `/categories/`
- Response: `200 OK` + `Category[]`

### POST `/categories/`
- Body:
```json
{
  "name": "Programming"
}
```
- Success: `201 Created` + `Category`
- Loi: `400 Bad Request` neu name trung

## 3.9 Manager Service (`http://localhost:8009`)

### GET `/managers/`
- Response: `200 OK` + `Manager[]`

### POST `/managers/`
- Body:
```json
{
  "name": "Manager 1",
  "email": "manager@example.com"
}
```
- Success: `201 Created` + `Manager`
- Loi: `400 Bad Request` neu email trung/invalid

## 3.10 Staff Service (`http://localhost:8004`)

Service nay proxy qua book-service de staff thao tac sach.

### GET `/staff/books/`
- Response: `200 OK` + `Book[]`

### POST `/staff/books/`
- Body giong book-service `/books/`
- Response: `201 Created` + `Book`

### PUT `/staff/books/{book_id}/`
- Body partial/full giong `/books/{book_id}/`
- Response: `200 OK` + `Book`

### DELETE `/staff/books/{book_id}/`
- Response: `204 No Content`

## 3.11 Recommender AI Service (`http://localhost:8011`)

### GET `/recommendations/`
- Mo ta: Lay toi da 5 sach con hang (`stock > 0`) tu book-service.
- Response: `200 OK` + `Book[]`
- Loi: `503 Service Unavailable` neu khong reach duoc book-service

## 4) API Gateway UI (tham khao)

Gateway nay render HTML server-side, khong phai REST JSON cho FE SPA moi.
Neu ban viet lai FE (React/Vue/Next...), nen goi truc tiep cac service o muc 3.

UI routes hien co:
- `/`
- `/books-ui/`
- `/cart-ui/{customer_id}/`
- `/orders-ui/{customer_id}/`
- `/payments-ui/{order_id}/`
- `/reviews-ui/{book_id}/`
- `/managers-ui/`
- `/categories-ui/`
- `/customers-ui/`
- `/shipments-ui/{order_id}/`
- `/recommendations-ui/`
- `/staff-ui/`

## 5) FE Flow de xay lai nhanh

Luong user dat sach de nghi:
1. Tao customer: `POST /customers/`
2. Lay sach: `GET /books/`
3. Them vao gio: `POST /cart-items/` (can `cart` id)
4. Xem gio theo customer: `GET /carts/{customer_id}/`
5. Tao order: `POST /orders/`
6. Xem payment/ship:
   - `GET /payments/{order_id}/`
   - `GET /shipments/{order_id}/`
7. Danh gia sach: `POST /reviews/`, `GET /reviews/book/{book_id}/`

Goi y UX:
- Sau khi tao customer, luu `customer.id` va map den `cart` (co the goi them endpoint cart neu can).
- Khi tao order xong, refresh payment/shipment sau 1-2 giay vi service tao theo best-effort.

## 6) Cac han che can biet truoc khi lam FE

- Chua co auth/phan quyen.
- Chua co phan trang/filter/search.
- Loi lien service nhieu noi tra ve thong diep ngan gon (`error`).
- Chua co endpoint xoa cart item.
- Test automation gan nhu chua co.

## 7) Quick Test bang curl

```bash
# 1) Tao customer
curl -X POST http://localhost:8001/customers/ \
  -H "Content-Type: application/json" \
  -d '{"name":"A","email":"a1@example.com"}'

# 2) Tao book
curl -X POST http://localhost:8002/books/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Book 1","author":"Auth","price":"10.00","stock":20}'

# 3) Them item vao gio (cart id gia su = 1)
curl -X POST http://localhost:8003/cart-items/ \
  -H "Content-Type: application/json" \
  -d '{"cart":1,"book_id":1,"quantity":2}'

# 4) Tao order
curl -X POST http://localhost:8005/orders/ \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1}'
```

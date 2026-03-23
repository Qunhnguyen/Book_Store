# FE API Reference

## Overview
Tai lieu nay mo ta API ma frontend nen su dung de tich hop voi he thong hien tai.

- Base URL: `http://localhost:8000`
- FE chi nen goi qua API Gateway, khong goi truc tiep tung service noi bo
- Prefix chung: `/api/...`
- Content type: `application/json`

Gateway route hien tai nam o:
- `api-gateway/api_gateway/urls.py`
- `api-gateway/app/views.py`

## Auth
Backend dang dung JWT tai gateway.

### Public endpoints
Cac endpoint sau khong can token:
- `POST /api/login/`
- `POST /api/register/`
- `GET /api/books/`
- `GET /api/books/{book_id}/`
- `GET /api/categories/`
- `GET /api/categories/{category_id}/`
- `GET /api/reviews/book/{book_id}/`
- `GET /api/recommendations/`
- `GET /api/health/`
- `GET /api/metrics/`

### Protected endpoints
Nhung endpoint con lai can header:

```http
Authorization: Bearer <token>
```

Neu thieu token, gateway tra:

```json
{
  "error": "Unauthorized: Bearer token is required"
}
```

## Common Error Shape
System chua co mot schema loi duy nhat, nhung FE co the ky vong cac dang sau:

```json
{
  "error": "Human-readable message"
}
```

Hoac loi validation DRF:

```json
{
  "field_name": ["Error message"]
}
```

Ma loi thuong gap:
- `400`: input sai hoac business validation fail
- `401`: thieu token / token het han / token sai
- `404`: resource khong ton tai
- `409`: xung dot business, vi du xoa book khi inventory dang co reservation
- `503`: service downstream tam thoi khong reachable

## Data Models FE Nen Dung

### Book
```json
{
  "id": 1,
  "title": "Clean Architecture",
  "author": "Robert C. Martin",
  "price": "19.99",
  "stock": 4,
  "isbn": "9780134494166",
  "official_cover_url": null,
  "ai_image_url": null,
  "image_source": "PLACEHOLDER",
  "image_status": "NONE",
  "image_prompt": null,
  "image_generated_at": null,
  "image_last_checked_at": null,
  "display_image_url": "/static/placeholder-cover.png",
  "categories": [
    { "id": 1, "name": "Backend" },
    { "id": 2, "name": "Architecture" }
  ]
}
```

### Category
```json
{
  "id": 1,
  "name": "Backend"
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

### Login Response
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "customer_id": 1,
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

### Cart Item
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
  "status": "PENDING",
  "total_price": "39.98",
  "saga_id": "uuid-like-string",
  "correlation_id": "uuid-like-string"
}
```

### Payment
```json
{
  "id": 1,
  "order_id": 1,
  "payment_method": "COD",
  "status": "PAID"
}
```

### Shipment
```json
{
  "id": 1,
  "order_id": 1,
  "shipping_method": "STANDARD",
  "address": "123 Nguyen Trai",
  "status": "RESERVED"
}
```

### Review
```json
{
  "id": 1,
  "customer_id": 1,
  "book_id": 2,
  "rating": 5,
  "comment": "Sach rat hay"
}
```

## API Reference

### 1. Auth

#### `POST /api/register/`
Tao customer moi.

Request:
```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "secret123"
}
```

Success `201`:
```json
{
  "id": 1,
  "name": "Nguyen Van A",
  "email": "a@example.com"
}
```

Notes:
- Password khong tra ve trong response
- Sau khi register, customer-service se tu goi sang cart-service de tao mot cart mac dinh
- Neu cart-service loi, register co the bi rollback va tra `503`

#### `POST /api/login/`
Dang nhap va nhan JWT.

Request:
```json
{
  "email": "a@example.com",
  "password": "secret123"
}
```

Success `200`:
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "customer_id": 1,
  "name": "Nguyen Van A",
  "email": "a@example.com"
}
```

### 2. Books

#### `GET /api/books/`
Lay danh sach sach.

Success `200`:
```json
[
  {
    "id": 1,
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "price": "19.99",
    "stock": 4,
    "isbn": null,
    "official_cover_url": null,
    "ai_image_url": null,
    "image_source": "PLACEHOLDER",
    "image_status": "NONE",
    "image_prompt": null,
    "image_generated_at": null,
    "image_last_checked_at": null,
    "display_image_url": "/static/placeholder-cover.png",
    "categories": []
  }
]
```

#### `GET /api/books/{book_id}/`
Lay chi tiet sach.

#### `POST /api/books/`
Tao sach moi.

Request:
```json
{
  "title": "Domain-Driven Design",
  "author": "Eric Evans",
  "price": "29.99",
  "stock": 10,
  "isbn": "9780321125217",
  "category_ids": [1, 2]
}
```

Notes:
- `category_ids` la optional
- `stock` se duoc sync qua inventory-service
- Response tra `categories` da duoc resolve thanh object

#### `PUT /api/books/{book_id}/`
Cap nhat sach.

Request co the la partial theo implementation hien tai:
```json
{
  "stock": 7,
  "category_ids": [2, 3]
}
```

#### Response fields can read-only
- `official_cover_url`
- `ai_image_url`
- `image_source`
- `image_status`
- `image_prompt`
- `image_generated_at`
- `image_last_checked_at`
- `display_image_url`
- `categories`

### 3. Categories

#### `GET /api/categories/`
Lay danh sach category.

Success `200`:
```json
[
  { "id": 1, "name": "Backend" },
  { "id": 2, "name": "Architecture" }
]
```

#### `GET /api/categories/{category_id}/`
Lay chi tiet 1 category.

#### `POST /api/categories/`
Tao category moi.

Request:
```json
{
  "name": "Microservices"
}
```

### 4. Customers

#### `GET /api/customers/`
Lay danh sach customer.

Notes:
- Endpoint nay can JWT
- Khong nen dung cho public UI trinh bay thong thuong, chu yeu phuc vu admin/internal

### 5. Carts

#### `POST /api/carts/`
Tao cart thu cong.

Request:
```json
{
  "customer_id": 1
}
```

Success `201`:
```json
{
  "id": 1,
  "customer_id": 1
}
```

#### `GET /api/carts/{customer_id}/`
Lay danh sach cart item theo customer.

Success `200`:
```json
[
  {
    "id": 1,
    "cart": 1,
    "book_id": 2,
    "quantity": 3
  }
]
```

#### `DELETE /api/carts/{customer_id}/`
Xoa toan bo item trong cart cua customer.

Response status: `204`

#### `POST /api/cart-items/`
Them item vao cart.

Request:
```json
{
  "cart": 1,
  "book_id": 2,
  "quantity": 3
}
```

Success `201`:
```json
{
  "id": 1,
  "cart": 1,
  "book_id": 2,
  "quantity": 3
}
```

#### `PUT /api/cart-items/{item_id}/`
Cap nhat so luong.

Request:
```json
{
  "quantity": 5
}
```

#### `DELETE /api/cart-items/{item_id}/`
Xoa 1 item khoi cart.

Response status: `204`

### 6. Orders

#### `POST /api/orders/`
Tao order tu cart cua customer va kick off Saga.

Request:
```json
{
  "customer_id": 1
}
```

Test-only flags van ton tai trong backend:
```json
{
  "customer_id": 1,
  "force_payment_failure": true,
  "force_shipping_failure": true
}
```

Success `201`:
```json
{
  "id": 1,
  "customer_id": 1,
  "status": "PENDING",
  "total_price": "39.98",
  "saga_id": "...",
  "correlation_id": "..."
}
```

Important behavior:
- Neu cart rong, tra `400`
- Neu sach trong cart khong con ton tai hoac khong lay duoc pricing, order se khong duoc tao
- Cart chi bi clear sau khi Saga chot `CONFIRMED`
- Neu payment fail, order co the ve `CANCELLED` va cart van duoc giu

#### `GET /api/orders/{customer_id}/`
Lay danh sach order cua customer.

#### `GET /api/orders/`
Lay tat ca order.

### 7. Payments

#### `GET /api/payments/{order_id}/`
Lay payment theo order.

Success `200`:
```json
[
  {
    "id": 1,
    "order_id": 1,
    "payment_method": "COD",
    "status": "PAID"
  }
]
```

#### `GET /api/payments/`
Lay tat ca payment.

#### `POST /api/payments/`
Tao payment thu cong.

Request:
```json
{
  "order_id": 1,
  "payment_method": "COD"
}
```

Notes:
- Trong flow binh thuong cua he thong, FE khong can goi endpoint nay vi payment duoc tao boi Saga
- Endpoint nay huu ich cho admin/internal hoac test

### 8. Shipments

#### `GET /api/shipments/{order_id}/`
Lay shipment theo order.

Success `200`:
```json
[
  {
    "id": 1,
    "order_id": 1,
    "shipping_method": "STANDARD",
    "address": "",
    "status": "RESERVED"
  }
]
```

#### `GET /api/shipments/`
Lay tat ca shipment.

#### `POST /api/shipments/`
Tao shipment thu cong.

Request:
```json
{
  "order_id": 1,
  "shipping_method": "STANDARD",
  "address": "123 Nguyen Trai"
}
```

Notes:
- Trong flow binh thuong, FE khong can goi endpoint nay vi shipment duoc tao boi Saga

### 9. Reviews

#### `GET /api/reviews/book/{book_id}/`
Lay review theo book.

Success `200`:
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "book_id": 2,
    "rating": 5,
    "comment": "Sach rat hay"
  }
]
```

#### `POST /api/reviews/`
Tao review moi.

Request:
```json
{
  "customer_id": 1,
  "book_id": 2,
  "rating": 5,
  "comment": "Sach rat hay"
}
```

Validation:
- `rating` phai nam trong `[1..5]`
- `book_id` phai ton tai

#### `GET /api/reviews/`
Lay tat ca review.

### 10. Managers

#### `GET /api/managers/`
Lay danh sach manager.

#### `POST /api/managers/`
Tao manager.

Request:
```json
{
  "name": "Manager 1",
  "email": "manager1@example.com"
}
```

### 11. Staff Books
Day la alias admin/staff proxy sang book-service.

#### `GET /api/staff/books/`
#### `POST /api/staff/books/`
#### `PUT /api/staff/books/{book_id}/`
#### `DELETE /api/staff/books/{book_id}/`

Payload va response giong `Books API`.

### 12. Recommendations

#### `GET /api/recommendations/`
Tra ve toi da 5 sach con hang.

Success `200`:
```json
[
  {
    "id": 1,
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "price": "19.99",
    "stock": 4,
    "isbn": null,
    "official_cover_url": null,
    "ai_image_url": null,
    "image_source": "PLACEHOLDER",
    "image_status": "NONE",
    "image_prompt": null,
    "image_generated_at": null,
    "image_last_checked_at": null,
    "display_image_url": "/static/placeholder-cover.png",
    "categories": []
  }
]
```

## Status Values FE Nen Biet

### Order status
Gia tri da thay trong code:
- `PENDING`
- `INVENTORY_RESERVED`
- `PAYMENT_RESERVED`
- `COMPENSATING`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

### Payment status
Gia tri da thay trong code/consumer:
- `PENDING`
- `PAID`
- `FAILED`
- `REFUNDED`

### Shipment status
Gia tri da thay trong code/consumer:
- `PENDING`
- `RESERVED`
- `FAILED`
- `CANCELLED`

### Book image status
- `NONE`
- `PENDING`
- `GENERATING`
- `READY`
- `FAILED`

### Book image source
- `OFFICIAL`
- `AI`
- `PLACEHOLDER`

## Recommended FE Flow
1. `POST /api/register/` hoac `POST /api/login/`
2. Luu `token` va `customer_id`
3. Load `GET /api/books/` va `GET /api/categories/`
4. Chon sach va quan ly cart
5. `POST /api/orders/` de checkout
6. Poll `GET /api/orders/{customer_id}/` de theo doi status order
7. Khi can, load `GET /api/payments/{order_id}/` va `GET /api/shipments/{order_id}/`
8. Sau mua hang, goi `POST /api/reviews/`

## Known Gaps / Caveats
- `POST /api/cart-items/` can `cart_id`, nhung system hien tai khong co endpoint rieng de lay `cart` object theo `customer_id`; `GET /api/carts/{customer_id}/` chi tra cart items.
- `register` tu tao mot cart mac dinh, nhung response register khong tra `cart_id`.
- Vi gap tren, FE se can co workaround tam thoi neu muon add cart-item chuan: hoac cache `cart_id` tu luc tu tao cart bang `POST /api/carts/`, hoac backend can bo sung them endpoint tra cart theo customer.
- `POST /api/payments/` va `POST /api/shipments/` ton tai, nhung trong user flow binh thuong frontend khong nen goi truc tiep vi he thong da chay Saga.
- Gateway dang dung prefix public path, nen `GET /api/books/{id}/` va `GET /api/categories/{id}/` hien tai cung la public.

## FE Typescript Suggestion
```ts
export type Category = {
  id: number;
  name: string;
};

export type Book = {
  id: number;
  title: string;
  author: string;
  price: string;
  stock: number;
  isbn: string | null;
  official_cover_url: string | null;
  ai_image_url: string | null;
  image_source: 'OFFICIAL' | 'AI' | 'PLACEHOLDER';
  image_status: 'NONE' | 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
  image_prompt: string | null;
  image_generated_at: string | null;
  image_last_checked_at: string | null;
  display_image_url: string;
  categories: Category[];
};

export type LoginResponse = {
  message: string;
  token: string;
  customer_id: number;
  name: string;
  email: string;
};

export type Cart = {
  id: number;
  customer_id: number;
};

export type CartItem = {
  id: number;
  cart: number;
  book_id: number;
  quantity: number;
};

export type Order = {
  id: number;
  customer_id: number;
  status: 'PENDING' | 'INVENTORY_RESERVED' | 'PAYMENT_RESERVED' | 'COMPENSATING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';
  total_price: string;
  saga_id: string;
  correlation_id: string;
};

export type Payment = {
  id: number;
  order_id: number;
  payment_method: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
};

export type Shipment = {
  id: number;
  order_id: number;
  shipping_method: string;
  address: string;
  status: 'PENDING' | 'RESERVED' | 'FAILED' | 'CANCELLED';
};

export type Review = {
  id: number;
  customer_id: number;
  book_id: number;
  rating: number;
  comment: string;
};
```

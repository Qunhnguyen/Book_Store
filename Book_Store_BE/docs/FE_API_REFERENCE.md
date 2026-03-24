# FE API Reference

This document provides the standard API specifications for the frontend to integrate with the Book Store Backend.
All API endpoints go through the **API Gateway**, typically running on `http://localhost:8000`.

- FE chỉ nên gọi qua API Gateway, không gọi trực tiếp từng service nội bộ.
- Prefix chung: `/api/...`
- Content type: `application/json`

---

## 🔐 Auth & Security
- **Authentication**: JWT (JSON Web Token)
- **Header format**: `Authorization: Bearer <token>`
- Endpoints marked với 🔒 require authentication.

Nếu thiếu token (trên protected endpoints), gateway trả về:
```json
{
  "error": "Unauthorized: Bearer token is required"
}
```

## Common Error Shape
Hệ thống chưa có một schema lỗi duy nhất, nhưng FE có thể kỳ vọng các dạng sau:

```json
{
  "error": "Human-readable message"
}
```
Hoặc lỗi validation DRF:
```json
{
  "field_name": ["Error message"]
}
```

Mã lỗi thường gặp:
- `400`: input sai hoặc business validation fail
- `401`: thiếu token / token hết hạn / token sai
- `404`: resource không tồn tại
- `409`: xung đột business, ví dụ xóa book khi inventory đang có reservation
- `503`: service downstream tạm thời không reachable

---

## API Reference

### 1. Authentication & Users

#### 1.1 Customer Registration
- **URL:** `/api/register/`
- **Method:** `POST`
- **Authentication:** None
- **Request Body:**
  ```json
  {
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "password": "securepassword123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 1,
    "name": "Nguyen Van A",
    "email": "a@example.com"
  }
  ```
  *(Note: Password không được trả về trong response. Một cart mặc định sẽ tự động được tạo cho user qua cart-service)*

#### 1.2 Customer Login
- **URL:** `/api/login/`
- **Method:** `POST`
- **Authentication:** None
- **Request Body:**
  ```json
  {
    "email": "a@example.com",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...",
    "customer_id": 1,
    "name": "Nguyen Van A",
    "email": "a@example.com"
  }
  ```

#### 1.3 Get All Customers 🔒
- **URL:** `/api/customers/`
- **Method:** `GET`
- **Response (200 OK):** Array of customer objects.
*(Note: Endpoint này chủ yếu phục vụ admin/internal, không dùng cho public UI)*

---

### 2. Product Catalog (Books & Categories)

#### 2.1 Get All Books
- **URL:** `/api/books/`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "title": "Clean Code",
      "author": "Robert C. Martin",
      "price": "29.99",
      "stock": 15,
      "isbn": "9780132350884",
      "official_cover_url": null,
      "ai_image_url": null,
      "image_source": "PLACEHOLDER",
      "image_status": "NONE",
      "display_image_url": "/static/placeholder-cover.png",
      "categories": [
        {"id": 1, "name": "Programming"}
      ]
    }
  ]
  ```

#### 2.2 Get Book Details
- **URL:** `/api/books/<book_id>/`
- **Method:** `GET`

#### 2.3 Get Categories
- **URL:** `/api/categories/`
- **Method:** `GET`

#### 2.4 Get Category Details
- **URL:** `/api/categories/<category_id>/`
- **Method:** `GET`

#### 2.5 Get Personalized Recommendations
- **URL:** `/api/recommendations/`
- **Method:** `GET`
- **Response (200 OK):** Trả về tối đa 5 sách còn quyển, theo định dạng một array.

---

### 3. Cart Management

#### 3.1 Get Cart Items by Customer 🔒
- **URL:** `/api/carts/<customer_id>/`
- **Method:** `GET`
- **Response (200 OK):**
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

#### 3.2 Add Item to Cart 🔒
- **URL:** `/api/cart-items/`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "cart": 1, 
    "book_id": 1,
    "quantity": 2
  }
  ```

#### 3.3 Remove/Update Cart Item 🔒
- **URL:** `/api/cart-items/<item_id>/`
- **Methods:** `PUT` (Update số lượng), `DELETE` (Remove item ra khỏi cart)

---

### 4. Ordering & Checkout (Saga Pattern)

#### 4.1 Create Order (Checkout) 🔒
- **URL:** `/api/orders/`
- **Method:** `POST`
- **Desc:** Triggers the Saga orchestrator. Lấy thông tin cart của user, tính tổng giá, clear cart, và tạo một Order có status là `PENDING`.
- **Request Body:**
  ```json
  {
    "customer_id": 1
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 101,
    "customer_id": 1,
    "status": "PENDING",
    "total_price": "59.98",
    "saga_id": "uuid-...",
    "correlation_id": "uuid-..."
  }
  ```
*(Note: Nếu cart rỗng thì sẽ trả về status 400. Cart chỉ bị xoá item sau khi Saga chốt `CONFIRMED`)*

#### 4.2 Get Orders by Customer 🔒
- **URL:** `/api/orders/<customer_id>/`
- **Method:** `GET`
- **Desc:** Dùng phương thức HTTP GET này để cập nhật (poll) status của Order (ví dụ: `PENDING` -> `PAYMENT_RESERVED` -> `CONFIRMED` hoặc là bị `CANCELLED` vì lỗi tồn kho hoặc thanh toán).

---

### 5. Payments & Shipping

#### 5.1 Determine Payment Status 🔒
- **URL:** `/api/payments/<order_id>/`
- **Method:** `GET`
- **Response (200 OK):** Array cung cấp chi tiết toàn bộ status thanh toán của Order đó.

#### 5.2 Determine Shipping Status 🔒
- **URL:** `/api/shipments/<order_id>/`
- **Method:** `GET`
- **Response (200 OK):** Array chi tiết về hành trình Giao Hàng của Order.

> **Note**: Frontend Flow chuẩn sẽ không chủ động POST các lệnh yêu cầu payment hoặc shipment mới, vì luồng thanh toán và giao dịch sẽ do Microservice xử lý qua mô hình Event Driven (Saga).

---

### 6. Feedback & Reviews

#### 6.1 Get Reviews for a Book
- **URL:** `/api/reviews/book/<book_id>/`
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "customer_id": 1,
      "book_id": 1,
      "rating": 5,
      "comment": "Sach rat hay!"
    }
  ]
  ```

#### 6.2 Submit a Review 🔒
- **URL:** `/api/reviews/`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "customer_id": 1,
    "book_id": 1,
    "rating": 5,
    "comment": "Tuyệt vời vãi chưởng"
  }
  ```

---

### 7. Observability & Health

- `GET /api/health/` - Liveness probe, không bắt buộc truyền thư mục Auth Headers
- `GET /api/metrics/` - Prometheus metrics, trả về metrics không thuộc dạng JSON

---

## Status Values FE Nên Biết

### Order status
- `CREATED`, `PENDING`
- `INVENTORY_RESERVED`
- `PAYMENT_RESERVED`
- `COMPENSATING`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

### Payment status
- `PENDING`
- `PAID`
- `FAILED`
- `REFUNDED`

### Shipment status
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

---

## Recommended FE Flow
1. `POST /api/register/` hoặc `POST /api/login/`
2. Lưu `token` và `customer_id` vào state module (React Redux/Context) hoặc localStorage.
3. Call `GET /api/books/` (trang chủ) và `GET /api/categories/`
4. Chọn sách và thêm sách đó vào cart item (Bằng Endpoint `POST /api/cart-items/`)
5. Click thanh toán để gọi `POST /api/orders/` 
6. Đặt lệnh Poll `GET /api/orders/{customer_id}/` khoảng một giây 1 lần ở màn Checkout để đón chờ thay đổi của Saga tự cập nhật.
7. Khi có báo lỗi hoặc confirm, get API `GET /api/payments/{order_id}/` / `GET /api/shipments/{order_id}/` (tuỳ logic UI)
8. Khi KH đọc xong cuốn sách, họ sẽ dùng `POST /api/reviews/` để gửi nhận xét.

---

## Known Gaps / Caveats
- `POST /api/cart-items/` cần có `cart` (mã ID đại diện cho record gốc thuộc về Customer), nhưng BE hiện chưa có API riêng nào để trả object Cart trống (DUY NHẤT có `/api/carts/<customer_id>/` thường nó cũng chỉ trả item). FE nên chú ý có thể phải workaround tạm thời để có biến ID cart truyền vào (VD POST `/carts/` 1 lần cho chắc ăn).
- Các API update sách trong nội dung app (`/api/staff/books/`) bị uỷ quyền sang `book-service`, yêu cầu Authentication (chỉ role manager/staff).

---

## FE Typescript Suggestion Dành cho Dev
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

export type CartItem = {
  id: number;
  cart: number;
  book_id: number;
  quantity: number;
};

export type Order = {
  id: number;
  customer_id: number;
  status: 'CREATED' | 'PENDING' | 'INVENTORY_RESERVED' | 'PAYMENT_RESERVED' | 'COMPENSATING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';
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

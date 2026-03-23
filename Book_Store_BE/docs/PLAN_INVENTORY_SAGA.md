# Plan: Dua Inventory vao Saga

## 1. Summary
Tai lieu nay mo ta ke hoach dua nghiep vu ton kho vao luong Saga cua he thong Book Store Backend.

Muc tieu:
- bo cach tru stock dong bo qua HTTP trong `order-service`
- dua inventory thanh mot Saga participant dung nghia
- ho tro compensation day du khi payment/shipping fail
- tranh tinh trang order `CANCELLED` nhung stock da bi tru

Ket qua mong muon:
- tao moi `inventory-service` va `inventory-consumer`
- `book-service` chi con giu metadata sach
- luong checkout chay theo `reserve -> commit -> release`

## 2. Current State
Hien tai:
- `order-service` tao `Order` va `OrderItem`
- sau do goi HTTP `POST /books/deduct-stock/` sang `book-service`
- neu goi thanh cong thi stock bi tru ngay, truoc khi Saga payment/shipping ket thuc
- neu payment fail hoac shipping fail, he thong khong co buoc restore stock

Van de:
- stock nam ngoai Saga
- compensation khong day du
- co the xay ra inconsistency giua `order`, `payment`, `shipping`, va `book`

## 3. Target Architecture

### 3.1 Service moi
Them `inventory-service` voi database rieng `inventory_db`.

Service nay la source of truth cho ton kho va chiu trach nhiem:
- reserve stock khi order bat dau
- commit stock khi Saga thanh cong
- release stock khi Saga bi huy
- dam bao idempotency cho inventory event

### 3.2 Data model
`inventory-service` can co it nhat 3 model:

1. `InventoryItem`
- `book_id`
- `available_qty`
- `reserved_qty`

2. `InventoryReservation`
- `saga_id`
- `order_id`
- `book_id`
- `quantity`
- `status`

Gia tri `status`:
- `RESERVED`
- `COMMITTED`
- `RELEASED`

3. `ProcessedEvent`
- `event_id`
- `processed_at`

Rang buoc quan trong:
- unique `(saga_id, book_id)` cho `InventoryReservation`
- unique `event_id` cho `ProcessedEvent`

### 3.3 Ownership
- `inventory-service` quan ly stock va reservation
- `book-service` chi quan ly thong tin sach va hinh anh
- `order-service` van la Saga orchestrator

## 4. Saga Flow Moi

### 4.1 Happy path
1. `order-service` tao `Order` va `OrderItem`, dat `status=PENDING`
2. `order-service` publish `inventory.reserve.requested`
3. `inventory-consumer` reserve stock
4. `inventory-service` publish `inventory.reserve.completed(success=True)`
5. `order-consumer` dat order thanh `INVENTORY_RESERVED`
6. `order-service` publish `payment.reserve.requested`
7. `pay-consumer` xu ly payment va publish `payment.reserve.completed(success=True)`
8. `order-consumer` dat order thanh `PAYMENT_RESERVED`
9. `order-service` publish `shipping.reserve.requested`
10. `ship-consumer` xu ly shipping va publish `shipping.reserve.completed(success=True)`
11. `order-consumer` publish `inventory.commit.requested`
12. `inventory-consumer` commit reservation va publish `inventory.commit.completed(success=True)`
13. `order-consumer` dat order thanh `CONFIRMED`

### 4.2 Inventory fail
1. `order-service` publish `inventory.reserve.requested`
2. `inventory-consumer` khong reserve duoc stock
3. `inventory-service` publish `inventory.reserve.completed(success=False)`
4. `order-consumer` dat order thanh `CANCELLED`
5. khong publish payment, khong publish shipping

### 4.3 Payment fail sau khi inventory da reserve
1. inventory reserve thanh cong
2. payment reserve that bai
3. `order-consumer` dat order thanh `COMPENSATING`
4. `order-service` publish `inventory.release.requested`
5. `inventory-consumer` release reservation
6. `inventory-service` publish `inventory.release.completed(success=True)`
7. `order-consumer` dat order thanh `CANCELLED`

### 4.4 Shipping fail sau khi payment thanh cong
1. inventory reserve thanh cong
2. payment reserve thanh cong
3. shipping reserve that bai
4. `order-consumer` dat order thanh `COMPENSATING`
5. `order-service` publish `payment.compensate.requested`
6. `pay-consumer` refund va publish `payment.compensate.completed(success=True)`
7. `order-consumer` publish `inventory.release.requested`
8. `inventory-consumer` release reservation
9. `inventory-service` publish `inventory.release.completed(success=True)`
10. `order-consumer` dat order thanh `CANCELLED`

### 4.5 Thu tu compensation
Thu tu mac dinh cho v1:
1. refund payment
2. release inventory
3. mark order `CANCELLED`

## 5. Event Contract

### 5.1 Event moi
Them cac event sau:
- `inventory.reserve.requested`
- `inventory.reserve.completed`
- `inventory.commit.requested`
- `inventory.commit.completed`
- `inventory.release.requested`
- `inventory.release.completed`

### 5.2 Payload toi thieu
Tat ca event inventory phai mang day du:

```json
{
  "event_id": "uuid",
  "event_type": "inventory.reserve.requested",
  "event_version": "1.0",
  "saga_id": "uuid",
  "correlation_id": "uuid",
  "timestamp": 1710753600,
  "payload": {
    "order_id": 1,
    "customer_id": 1,
    "items": [
      { "book_id": 1, "quantity": 2 }
    ],
    "success": true,
    "message": ""
  }
}
```

Quy uoc:
- `requested` event co the khong can `success`, nhung schema service nen doc duoc ca khi field nay vang mat
- `completed` event bat buoc co `success`
- `message` duoc dung cho ly do fail, vi du `Not enough stock for book 3`

## 6. Public API va Wiring Changes

### 6.1 `order-service`
Can thay doi:
- bo goi HTTP `POST /books/deduct-stock/` trong luong tao order
- van giu logic doc cart va tinh `total_price`
- sau khi tao order xong, publish `inventory.reserve.requested` thay vi `payment.reserve.requested`

Can mo rong orchestrator de xu ly them:
- `inventory.reserve.completed`
- `inventory.commit.completed`
- `inventory.release.completed`

State machine moi cua `Order`:
- `PENDING`
- `INVENTORY_RESERVED`
- `PAYMENT_RESERVED`
- `COMPENSATING`
- `CONFIRMED`
- `CANCELLED`

### 6.2 `inventory-service`
Them service Django moi voi:
- endpoint health/metrics
- `events.py`
- `management/commands/run_consumer.py`
- model inventory
- migration ban dau

Queue va binding:
- queue: `inventory_service_queue`
- bindings:
  - `inventory.reserve.requested`
  - `inventory.commit.requested`
  - `inventory.release.requested`

### 6.3 `book-service`
Can thay doi:
- khong con xu ly nghiep vu stock trong checkout path
- endpoint `POST /books/deduct-stock/` duoc deprecated hoac xoa khoi luong checkout
- co the giu tam thoi cho backward compatibility, nhung khong duoc goi tu `order-service`

### 6.4 Infrastructure
Cap nhat:
- `docker-compose.yml`
- `postgres-init.sh`
- `setup_dbs.sh`
- `PROJECT_OVERVIEW.md`
- huong dan test phase moi

Them container:
- `inventory-service`
- `inventory-consumer`

## 7. Implementation Notes

### 7.1 Idempotency
`inventory-service` phai dung `ProcessedEvent` de bo qua event trung.

`order-service` tiep tuc dung state-machine guard:
- chi xu ly `inventory.reserve.completed` khi order dang `PENDING`
- chi xu ly `payment.reserve.completed` khi order dang `INVENTORY_RESERVED`
- chi xu ly `shipping.reserve.completed` khi order dang `PAYMENT_RESERVED`
- chi xu ly `inventory.commit.completed` hoac `inventory.release.completed` khi order dang cho dung ket qua do

### 7.2 Concurrency
`inventory.reserve.requested` phai xu ly trong transaction.

Yeu cau:
- lock dong `InventoryItem` can thiet
- khong cho `available_qty` am
- khong tao hai reservation cho cung `saga_id + book_id`

### 7.3 Failure handling
Neu publish event fail:
- log day du `event_type`, `saga_id`, `correlation_id`
- retry theo chuan hien co cua `order-service`
- `inventory-service` nen dung retry tuong tu `order-service`, khong dung publisher implementation ngan hon nhu `pay-service`/`ship-service`

### 7.4 Seed va dong bo du lieu
Can co mot co che khoi tao `InventoryItem` cho sach hien co.

Lua chon cho v1:
- tao script seed inventory dua tren danh sach `Book`
- moi sach moi tao trong `book-service` can co inventory record tuong ung, co the bang HTTP call hoac event bootstrap rieng

## 8. Migrations
Can bo sung:
- migration khoi tao bang cho `inventory-service`
- migration update `Order.status` docs/tests neu can

Khong co cross-service foreign key.

## 9. Test Plan

### 9.1 Automated tests
Can bo sung test cho:
- happy path: reserve inventory -> payment -> shipping -> commit inventory -> `CONFIRMED`
- inventory fail: order `CANCELLED`, khong tao payment/shipment
- payment fail sau inventory reserve: inventory release -> `CANCELLED`
- shipping fail sau payment success: refund -> inventory release -> `CANCELLED`
- duplicate inventory events: khong double reserve, khong double release
- reconnect broker: consumer mat ket noi va tu noi lai
- concurrent order tren cung book: khong oversell

### 9.2 Manual verification
Can kiem tra:
- inventory row thay doi dung khi order thanh cong
- `reserved_qty` tro ve 0 sau commit hoac release
- order state transition dung theo event flow
- queue binding va message persistence hoat dong dung

## 10. Acceptance Criteria
Chap nhan khi tat ca dieu sau dung:
- `order-service` khong con goi `/books/deduct-stock/` trong checkout flow
- inventory duoc reserve truoc payment
- inventory chi bi commit sau khi shipping thanh cong
- payment fail va shipping fail deu tra stock ve dung
- khong co truong hop order `CANCELLED` nhung stock bi mat
- duplicate event khong lam sai so lieu inventory
- log co day du `event_type`, `saga_id`, `correlation_id`

## 11. Assumptions
- khong tao inventory API rieng cho FE trong v1
- FE tiep tuc lay danh sach sach tu `book-service`
- thong tin stock hien thi tren FE co the duoc hydrate sau, khong phai scope bat buoc cua tai lieu nay
- compensation order cho inventory se la `payment refund` truoc, `inventory release` sau
- `inventory-service` duoc uu tien implement truoc plan catalog vi day la loi consistency nghiem trong hon

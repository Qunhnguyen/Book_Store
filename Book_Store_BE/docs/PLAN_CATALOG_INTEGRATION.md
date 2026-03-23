# Plan: Tich hop Catalog vao Domain Book

## 1. Summary
Tai lieu nay mo ta ke hoach bien `catalog-service` thanh mot phan that su cua domain `book`.

Muc tieu:
- dung `catalog-service` lam source of truth cho category
- tich hop category vao `book-service` theo mo hinh many-to-many
- cap nhat gateway va UI/FE de tao, sua, hien thi category cho sach

Ket qua mong muon:
- book co the gan nhieu category
- category metadata duoc lay tu `catalog-service`
- books API tra ve ca `category_ids` va `categories`

## 2. Current State
Hien tai:
- `catalog-service` chi co model `Category(name)` va endpoint `GET/POST /categories/`
- `book-service` khong luu quan he voi category
- gateway co proxy va UI cho categories, nhung categories khong duoc dung trong book flow
- FE co endpoint `/api/categories/` nhung khong co schema book-category

Van de:
- `catalog-service` dang dung nhu mot module CRUD doc lap
- category khong anh huong den danh sach sach, chi tiet sach, tao/sua sach, hay filtering

## 3. Target Architecture

### 3.1 Ownership
- `catalog-service` so huu category metadata
- `book-service` so huu quan he giua book va category
- khong tao foreign key cross-service

### 3.2 Data model
Tai `book-service`, them bang lien ket:

`BookCategoryLink`
- `book_id`
- `category_id`

Rang buoc:
- unique `(book_id, category_id)`

Khong them `ForeignKey` toi `catalog-service`, chi luu remote id.

### 3.3 Relation model
Mo hinh duoc chon: `many-to-many`

Mot sach:
- co the khong co category nao
- co the thuoc nhieu category

Mot category:
- co the duoc gan cho nhieu sach

## 4. API Changes

### 4.1 `catalog-service`
Can mo rong API:
- giu `GET /categories/`
- giu `POST /categories/`
- them `GET /categories/<id>/`
- them bulk resolve qua `GET /categories/?ids=1,2,3`

Bulk endpoint can:
- nhan query string `ids`
- tra ve danh sach category theo thu tu hop ly, khong bat buoc giong thu tu input
- bo qua category khong ton tai hoac tra loi validation ro rang, tuy implementation chon mot cach va ghi ro trong code

Khuyen nghi cho v1:
- neu co `ids`, tra ve danh sach category ton tai
- viec validate "thieu id nao" se do `book-service` xu ly bang cach so sanh input va output

### 4.2 `book-service`
Books API thay doi payload.

#### Create/Update request
Cho phep gui:

```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": "29.99",
  "stock": 15,
  "category_ids": [1, 3, 5]
}
```

#### Response
Books API tra ve:

```json
{
  "id": 1,
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": "29.99",
  "stock": 15,
  "category_ids": [1, 3, 5],
  "categories": [
    { "id": 1, "name": "Programming" },
    { "id": 3, "name": "Backend" },
    { "id": 5, "name": "Architecture" }
  ]
}
```

Serializer moi:
- `category_ids`: writable, optional
- `categories`: read-only

Mac dinh:
- neu client khong gui `category_ids`, he thong giu tuong thich nguoc
- response van tra `category_ids: []` va `categories: []` neu khong co du lieu

### 4.3 `api-gateway`
Khong doi route chinh:
- tiep tuc proxy `/api/categories/`
- books API qua gateway tu dong tra schema moi co category data

Neu them detail category route, gateway can duoc mo rong de support:
- `/api/categories/<id>/`

## 5. Write Rules

### 5.1 Validate category khi ghi book
Khi `POST /books/` hoac `PUT/PATCH /books/<id>/`:
1. doc `category_ids`
2. normalize thanh danh sach int duy nhat
3. goi sang `catalog-service` de bulk resolve bang `ids`
4. neu output khong day du tat ca id da gui -> tra `400`
5. neu hop le -> ghi `Book`
6. replace toan bo `BookCategoryLink` theo tap `category_ids` moi

### 5.2 Replace strategy
V1 su dung replace-toan-bo relation khi create/update:
- xoa cac relation cu khong con trong request
- tao relation moi chua ton tai

Ly do:
- don gian
- de test
- tranh merge logic phuc tap

## 6. Read Rules

### 6.1 List books
`GET /books/` can:
1. lay danh sach `Book`
2. lay link categories cho tat ca book trong page/query hien tai
3. gom tap `category_id` duy nhat
4. goi bulk sang `catalog-service`
5. hydrate `categories` cho tung book

### 6.2 Book detail
`GET /books/<id>/` can:
1. lay `Book`
2. lay link category cua book
3. goi bulk hoac detail sang `catalog-service`
4. tra `category_ids` va `categories`

### 6.3 Failure mode khi catalog khong reachable
Khuyen nghi cho v1:
- create/update book: fail fast voi `503`, vi can validate category
- read book/list:
  - neu metadata category khong lay duoc, uu tien tra `503` de tranh payload nua dung nua sai
  - neu team muon degrade gracfully sau nay, can co flag rieng, khong nam trong v1

## 7. Delete Rules

### 7.1 Delete category
V1 mac dinh khong cho xoa category dang duoc gan cho book.

Can co mot API guard:
- `catalog-service` truoc khi xoa se check usage
- co the bang HTTP call sang `book-service` de hoi category co dang duoc dung khong

Neu dang duoc dung:
- tra `409 Conflict` hoac `400` voi message business ro rang

Khuyen nghi:
- dung `409 Conflict`
- message: `Category is assigned to one or more books`

### 7.2 Delete book
Khi xoa book:
- `book-service` can xoa `BookCategoryLink` lien quan
- category metadata tai `catalog-service` khong bi anh huong

## 8. Backend Implementation Changes

### 8.1 `catalog-service`
Can them:
- endpoint detail category
- support bulk query theo `ids`
- optional delete guard neu scope co bao gom xoa category

### 8.2 `book-service`
Can them:
- model `BookCategoryLink`
- migration cho bang lien ket
- utility client goi `catalog-service`
- serializer support `category_ids` va `categories`
- logic create/update/read hydration

### 8.3 `api-gateway`
Can cap nhat:
- routing neu them category detail endpoint
- tai lieu API/FE de mo ta schema moi

## 9. Full-Stack Scope

### 9.1 Gateway UI hien co
Trang tao/sua sach can:
- load categories tu `/api/categories/`
- render multi-select category
- submit `category_ids`

Trang list/detail sach can:
- hien thi category badges/chips/names
- dam bao van hoat dong khi book khong co category

Trang categories UI:
- giu flow CRUD category nhu hien tai

### 9.2 Frontend app
Neu repo FE co mat trong giai doan implement, can cap nhat:
- model/types cho `Book`
- form create/edit book
- validation `category_ids`
- rendering category trong book card, table, detail page
- API client de goi `/api/categories/`

Neu repo FE khong co trong workspace:
- van giu ke hoach full-stack o muc contract va acceptance
- implementation FE co the duoc giao cho repo `BookstoreFE`

## 10. Migrations va Compatibility

### 10.1 Migration
Can them migration cho `BookCategoryLink`.

Khong can migration data bat buoc cho book hien co vi:
- category_ids co the mac dinh la rong
- response schema moi van backward-compatible

### 10.2 Backward compatibility
Dam bao:
- client cu khong gui `category_ids` van tao/sua book duoc
- client doc schema cu van nhan them field moi, khong bi vo behavior cu
- book khong category van hop le

## 11. Test Plan

### 11.1 Backend tests
Can bo sung:
- tao book voi nhieu category hop le
- tao book voi category khong ton tai -> `400`
- update book thay doi tap category
- list books tra ve dung `category_ids` va `categories`
- detail book tra ve dung `category_ids` va `categories`
- xoa book thi relation bi xoa
- xoa category dang duoc gan -> `409`
- regression: create/edit/delete book khong category van chay

### 11.2 Gateway/UI tests
Can kiem tra:
- form tao sach load duoc categories
- submit multi-select category thanh cong
- book list/detail hien thi dung category names
- category UI van CRUD duoc nhu cu

### 11.3 FE acceptance
Can pass:
- FE doc duoc categories tu gateway
- FE tao va sua book voi nhieu category
- FE hien thi duoc category badges
- FE xu ly loi `400`, `409`, `503`

## 12. Acceptance Criteria
Chap nhan khi:
- `catalog-service` khong con la CRUD service dung rieng
- `book-service` luu va tra quan he many-to-many voi category
- books API ho tro `category_ids` input va `categories` output
- gateway va UI co the tao/sua/hien thi category cho sach
- category dang duoc su dung khong bi xoa tu do
- luong cu khong category van hoat dong binh thuong

## 13. Assumptions
- `catalog-service` tiep tuc ton tai nhu service rieng
- `catalog-service` la source of truth cho category metadata
- quan he duoc luu cuc bo tai `book-service` bang `BookCategoryLink`
- xoa category dang duoc gan se bi chan o v1
- scope ke hoach bao gom backend, gateway, va frontend contract

# Book_Store Frontend (React + Vite)

Frontend nay duoc tao de lam viec voi he thong microservice trong du an Book_Store.

## 1) Cai dat

```bash
cd frontend
npm install
```

## 2) Chay local

```bash
npm run dev
```

Mac dinh Vite chay tai: `http://localhost:5173`

## 3) Build production

```bash
npm run build
npm run preview
```

## 4) Bien moi truong

Copy `.env.example` thanh `.env` neu ban muon doi URL backend.

Bien ho tro:
- `VITE_API_BASE_URL` (mac dinh: `http://localhost:8000`)

Frontend se goi qua API Gateway theo pattern `VITE_API_BASE_URL/api/...`.

## 5) Man hinh hien co

- Dashboard
- Books
- Customers
- Cart
- Orders
- Payments
- Shipments
- Reviews
- Categories
- Managers
- Staff
- Recommendations

## 6) Kien truc de scale

Frontend duoc to chuc theo module:

- `src/app`: shell layout + route config
- `src/features`: tung nghiep vu theo page/module
- `src/shared/components`: component tai su dung
- `src/shared/styles`: design tokens + global styles

Kieu to chuc nay giup them page moi nhanh, tach ro domain va de chia team.

## 7) Luu y

- FE hien tai la ban khoi tao de thao tac API nhanh, de mo rong tiep.
- Chua co auth/token vi backend hien tai chua cung cap.
- Can dam bao cac service backend dang chay bang docker compose truoc khi test FE.

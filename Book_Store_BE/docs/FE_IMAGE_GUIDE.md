# Hướng dẫn FE: Sử dụng Image Pipeline

## Tổng quan
Khi FE gọi `GET /api/books/`, mỗi book trả về 2 trường đặc biệt:

```json
{
  "id": 1,
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "price": "29.99",
  "stock": 15,
  "display_image_url": "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg",
  "image_status": "READY",
  "image_source": "OFFICIAL"
}
```

## Trường quan trọng cần dùng

| Trường | Mô tả |
|--------|-------|
| `display_image_url` | **Dùng cái này để hiển thị ảnh.** Backend tự chọn ảnh tốt nhất (Official → AI → Placeholder) |
| `image_status` | Trạng thái xử lý ảnh (xem bảng dưới) |
| `image_source` | Nguồn ảnh: `OFFICIAL`, `AI`, hoặc `PLACEHOLDER` |

## Các trạng thái `image_status`

| Status | Ý nghĩa | FE nên làm gì |
|--------|---------|---------------|
| `NONE` | Chưa xử lý | Hiển thị skeleton/loading |
| `PENDING` | Đã xếp hàng, chờ xử lý | Hiển thị skeleton/loading |
| `GENERATING` | Đang tải ảnh | Hiển thị spinner |
| `READY` | Có ảnh rồi ✅ | Hiển thị `display_image_url` |
| `FAILED` | Xử lý thất bại | Hiển thị ảnh placeholder mặc định |

## Cách hiển thị ảnh (React)

```jsx
const PLACEHOLDER = '/assets/placeholder-cover.png';

function BookCover({ book }) {
  const isLoading = ['NONE', 'PENDING', 'GENERATING'].includes(book.image_status);
  const imgUrl = book.display_image_url || PLACEHOLDER;

  if (isLoading) {
    return <div className="skeleton-cover" />;
  }

  return (
    <img
      src={imgUrl}
      alt={book.title}
      onError={(e) => { e.target.src = PLACEHOLDER; }} // fallback nếu URL lỗi
    />
  );
}
```

## Polling khi ảnh chưa sẵn sàng (nếu cần)

Nếu `image_status !== 'READY'` sau khi tạo book, FE có thể poll lại sau vài giây:

```js
// Sau khi POST /api/books/ thành công
async function waitForImage(bookId) {
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000)); // wait 3s
    const res = await fetch(`/api/books/${bookId}/`);
    const book = await res.json();
    if (book.image_status === 'READY') return book;
  }
}
```

## Endpoints mới cho FE (nếu cần)

```
POST /api/books/<id>/refresh-cover/
→ Yêu cầu BE tải lại ảnh từ Open Library cho book đó

POST /api/books/<id>/generate-ai-image/
→ Yêu cầu BE tạo ảnh AI mới cho book đó

POST /api/books/rebuild-missing-images/
→ Rebuild ảnh cho TẤT CẢ book chưa có hoặc bị lỗi
```

Tất cả trả về `202 Accepted` — tức là task đã được xếp hàng, ảnh sẽ cập nhật sau.

## Luồng hoàn chỉnh

```
FE tạo book → POST /api/books/
                    ↓ BE tự động gửi task lên Celery
                    ↓ Worker xử lý: Open Library → AI → Placeholder
                    ↓ Book.image_status = READY
FE poll hoặc refresh → GET /api/books/<id>/
                    ↓ display_image_url có giá trị thật
FE hiển thị ảnh ✅
```

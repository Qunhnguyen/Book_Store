# Book Image Pipeline — README

## Architecture

```
Frontend → API Gateway (8000) → book-service (8002)
                                       ↓ (Celery send_task)
                                redis (broker)
                                       ↓
                              image-worker (Celery)
                                 ├─ OpenLibraryService
                                 ├─ AIGeneratorService (DALL-E 3)
                                 └─ StorageAdapter (Cloudinary / local)
                                       ↓ PATCH
                                book-service (updates image fields)
```

## Quick Start

```bash
# 1. Start everything
docker compose up --build

# 2. Create a test book (triggers image pipeline automatically)
curl -X POST http://localhost:8002/books/ \
  -H 'Content-Type: application/json' \
  -d '{"title":"Clean Code","author":"Robert C. Martin","price":"29.99","stock":10,"isbn":"9780132350884"}'

# 3. Check book — display_image_url will update as worker runs
curl http://localhost:8002/books/1/
```

## Optional: AI Image Generation

Set your `OPENAI_API_KEY` in the environment before starting:

```bash
OPENAI_API_KEY=sk-... docker compose up --build
```

Or add it to `docker-compose.yml` under `image-service` and `image-worker`:
```yaml
environment:
  - OPENAI_API_KEY=sk-...
```

## Optional: Cloudinary Upload

Set the full `CLOUDINARY_URL` in the environment:
```bash
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
```

Without it, generated images are saved to `/tmp/` inside the worker and served with a placeholder URL.

## Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/books/<id>/refresh-cover/` | Re-enqueue cover fetch for a book |
| `POST` | `/api/books/<id>/generate-ai-image/` | Force AI generation for a book |
| `POST` | `/api/books/rebuild-missing-images/` | Queue all books with NONE/FAILED status |

## Run Tests

```bash
# book-service
cd book-service && python manage.py test

# image-service
cd image-service && python manage.py test
```

## Image Status Values

| Status | Meaning |
|--------|---------|
| `NONE` | Not processed yet |
| `PENDING` | Queued in Celery |
| `GENERATING` | Worker is processing |
| `READY` | Image URL available |
| `FAILED` | Max retries exceeded |

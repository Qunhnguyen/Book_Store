import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'book_service.settings')
sys.path.insert(0, 'book-service')
django.setup()

from app.models import Book, ImageSourceChoices, ImageStatusChoices

books_data = [
    {"title": "Clean Code", "author": "Robert C. Martin", "price": 29.99, "stock": 15, "isbn": "9780132350884"},
    {"title": "Design Patterns", "author": "Gang of Four", "price": 44.99, "stock": 8, "isbn": "9780201633610"},
    {"title": "Dune", "author": "Frank Herbert", "price": 19.99, "stock": 12, "isbn": "9780441013593"},
    {"title": "The Pragmatic Programmer", "author": "David Thomas", "price": 35.00, "stock": 10, "isbn": "9780135957059"},
]

for bk in books_data:
    book, created = Book.objects.get_or_create(
        title=bk['title'],
        defaults={
            "author": bk['author'],
            "price": bk['price'],
            "stock": bk['stock'],
            "isbn": bk['isbn'],
            "image_source": ImageSourceChoices.PLACEHOLDER,
            "image_status": ImageStatusChoices.READY,
        }
    )
    status = "✅ Created" if created else "✓ Exists"
    print(f"{status}: {bk['title']}")

print("\n✅ Seed books completed!")

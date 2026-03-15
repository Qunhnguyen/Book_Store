#!/usr/bin/env python
"""
Seed script: Insert sample books with real Open Library cover URLs into book-service DB.
Run from the book-service directory:
    python ../seed_books.py
"""

import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'book_service.settings')

# Must be run from book-service/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/book-service')

django.setup()

from app.models import Book, ImageSourceChoices, ImageStatusChoices

BOOKS = [
    {
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "price": "29.99",
        "stock": 15,
        "isbn": "9780132350884",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "The Pragmatic Programmer",
        "author": "David Thomas",
        "price": "35.00",
        "stock": 10,
        "isbn": "9780135957059",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780135957059-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "Design Patterns",
        "author": "Gang of Four",
        "price": "44.99",
        "stock": 8,
        "isbn": "9780201633610",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780201633610-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "The Hitchhiker's Guide to the Galaxy",
        "author": "Douglas Adams",
        "price": "14.99",
        "stock": 20,
        "isbn": "9780345391803",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "Dune",
        "author": "Frank Herbert",
        "price": "19.99",
        "stock": 12,
        "isbn": "9780441013593",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780441013593-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "Sapiens",
        "author": "Yuval Noah Harari",
        "price": "22.50",
        "stock": 18,
        "isbn": "9780062316097",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "Atomic Habits",
        "author": "James Clear",
        "price": "18.00",
        "stock": 25,
        "isbn": "9780735211292",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
    {
        "title": "1984",
        "author": "George Orwell",
        "price": "12.99",
        "stock": 30,
        "isbn": "9780451524935",
        "official_cover_url": "https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg",
        "official_cover_source": "openlibrary",
        "image_source": ImageSourceChoices.OFFICIAL,
        "image_status": ImageStatusChoices.READY,
    },
]

created = 0
skipped = 0

for data in BOOKS:
    obj, new = Book.objects.get_or_create(
        title=data['title'],
        author=data['author'],
        defaults={k: v for k, v in data.items() if k not in ('title', 'author')},
    )
    if new:
        created += 1
        print(f"  ✅ Created: {obj.title}")
    else:
        skipped += 1
        print(f"  ⏭  Skipped (exists): {obj.title}")

print(f"\nDone! Created {created} books, skipped {skipped} existing.")

#!/usr/bin/env python3
"""Fetch book covers from Open Library and update books"""
import requests
import json

GATEWAY = "http://api-gateway:8000"
BOOK_SERVICE = "http://book-service:8000"

# Open Library API
OL_COVER_URL = "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
OL_ISBN_API = "https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"

def get_cover_from_openlibrary(isbn):
    """Try to get cover URL from Open Library"""
    try:
        # Method 1: Direct cover URL
        cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
        resp = requests.head(cover_url, timeout=5)
        if resp.status_code == 200:
            return cover_url
            
        # Method 2: Search API
        resp = requests.get(OL_ISBN_API.format(isbn=isbn), timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            key = f"ISBN:{isbn}"
            if key in data:
                covers = data[key].get("cover", {})
                if covers.get("large"):
                    return covers["large"]
                if covers.get("medium"):
                    return covers["medium"]
        return None
    except Exception as e:
        print(f"   Error fetching cover for {isbn}: {e}")
        return None

# Get all books
print("📚 Fetching books from book-service...")
resp = requests.get(f"{BOOK_SERVICE}/books/", timeout=5)
books = resp.json() if resp.status_code == 200 else []

print(f"Found {len(books)} books\n")

for book in books:
    book_id = book.get("id")
    isbn = book.get("isbn")
    title = book.get("title")
    
    if not isbn:
        print(f"⏭️  Book {book_id} ({title}): No ISBN, skipping")
        continue
    
    cover_url = get_cover_from_openlibrary(isbn)
    
    if cover_url:
        print(f"✅ Book {book_id} ({title}): Found cover")
        print(f"   Cover URL: {cover_url}")
        
        # Update book with cover
        update_payload = {
            "official_cover_url": cover_url,
            "official_cover_source": "openlibrary",
            "image_source": "OFFICIAL",
            "image_status": "READY"
        }
        
        resp = requests.patch(f"{BOOK_SERVICE}/books/{book_id}/", json=update_payload, timeout=5)
        if resp.status_code == 200:
            print(f"   ✓ Updated in database")
        else:
            print(f"   ✗ Failed to update: {resp.status_code}")
    else:
        print(f"⚠️  Book {book_id} ({title}): No cover found on Open Library")
    
    print()

print("\n📖 Done! Books now have covers from Open Library.")

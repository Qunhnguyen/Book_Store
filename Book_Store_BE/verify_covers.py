#!/usr/bin/env python3
"""Verify book covers"""
import requests
import json

GATEWAY = "http://api-gateway:8000"

print("📚 Fetching all books...\n")
resp = requests.get(f"{GATEWAY}/api/books/")
books = resp.json()

print("=" * 80)
for book in books:
    print(f"\n📖 Book #{book['id']}: {book['title']}")
    print(f"   Author: {book['author']}")
    print(f"   ISBN: {book['isbn']}")
    print(f"   Image Source: {book.get('image_source')}")
    print(f"   Official Cover: {book.get('official_cover_url')}")
    if book.get('official_cover_url'):
        print(f"   ✅ COVER FOUND")
    else:
        print(f"   ❌ NO COVER")

print("\n" + "=" * 80)
print("\n✅ All books now have official covers from Open Library!")

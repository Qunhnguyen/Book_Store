import urllib.request
import json
import random
import time

def fetch_books_from_openlibrary(limit=250):
    url = f"https://openlibrary.org/search.json?q=programming&fields=title,author_name,isbn&limit={limit}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    print(f"Fetching books from {url}...")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        return data.get('docs', [])

def post_book_to_api(book_data):
    url = "http://localhost:8002/books/"
    payload = json.dumps(book_data).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            return response.status == 201
    except Exception as e:
        print(f"Failed to create {book_data['title']}: {e}")
        return False

def main():
    docs = fetch_books_from_openlibrary(limit=250)
    
    count = 0
    for doc in docs:
        if count >= 100:
            break
            
        title = doc.get('title')
        authors = doc.get('author_name', [])
        isbns = doc.get('isbn', [])
        
        if not title:
            continue
        if not authors:
            author = "Unknown Author"
        else:
            author = authors[0]
            
        if not isbns:
            # Fallback for books without official ISBN
            isbn = f"000{random.randint(1000000, 9999999)}"
        else:
            clean_isbns = [i.replace('-', '').replace(' ', '') for i in isbns]
            valid_isbns = [i for i in clean_isbns if len(i) in (10, 13) and i.isdigit()]
            if valid_isbns:
                isbn = valid_isbns[0]
            else:
                isbn = f"000{random.randint(1000000, 9999999)}"
        
        price = round(random.uniform(10.0, 80.0), 2)
        stock = random.randint(5, 100)
        
        book_data = {
            "title": title[:250],
            "author": author[:250],
            "price": str(price),
            "stock": stock,
            "isbn": isbn
        }
        
        if post_book_to_api(book_data):
            count += 1
            print(f"[{count}/100] Successfully inserted: {title[:50]} by {author[:30]}")
        else:
            print(f"API Rejected {title}")
        
        time.sleep(0.05)
        
    print(f"\\nDone! Successfully seeded {count} books.")

if __name__ == '__main__':
    main()

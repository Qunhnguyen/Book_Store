import requests
from django.shortcuts import render


def home_ui(request):
    return render(request, 'home.html')


def books_ui(request):
    books = []
    try:
        r = requests.get('http://book-service:8000/books/', timeout=3)
        if r.status_code == 200:
            books = r.json()
    except requests.RequestException:
        books = []
    return render(request, 'books.html', {'books': books})


def cart_ui(request, customer_id):
    items = []
    try:
        r = requests.get(f'http://cart-service:8000/carts/{customer_id}/', timeout=3)
        if r.status_code == 200:
            items = r.json()
    except requests.RequestException:
        items = []
    return render(request, 'cart.html', {'items': items, 'customer_id': customer_id})


def orders_ui(request, customer_id):
    orders = []
    try:
        r = requests.get(f'http://order-service:8000/orders/{customer_id}/', timeout=3)
        if r.status_code == 200:
            orders = r.json()
    except requests.RequestException:
        orders = []
    return render(request, 'orders.html', {'orders': orders, 'customer_id': customer_id})


def payments_ui(request, order_id):
    payments = []
    try:
        r = requests.get(f'http://pay-service:8000/payments/{order_id}/', timeout=3)
        if r.status_code == 200:
            payments = r.json()
    except requests.RequestException:
        payments = []
    return render(request, 'payments.html', {'payments': payments, 'order_id': order_id})


def reviews_ui(request, book_id):
    reviews = []
    try:
        r = requests.get(f'http://comment-rate-service:8000/reviews/book/{book_id}/', timeout=3)
        if r.status_code == 200:
            reviews = r.json()
    except requests.RequestException:
        reviews = []
    return render(request, 'reviews.html', {'reviews': reviews, 'book_id': book_id})


def managers_ui(request):
    managers = []
    try:
        r = requests.get('http://manager-service:8000/managers/', timeout=3)
        if r.status_code == 200:
            managers = r.json()
    except requests.RequestException:
        managers = []
    return render(request, 'managers.html', {'managers': managers})


def categories_ui(request):
    categories = []
    try:
        r = requests.get('http://catalog-service:8000/categories/', timeout=3)
        if r.status_code == 200:
            categories = r.json()
    except requests.RequestException:
        categories = []
    return render(request, 'categories.html', {'categories': categories})

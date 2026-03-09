import requests
from django.shortcuts import render, redirect


def home_ui(request):
    return render(request, 'home.html')


def books_ui(request):
    if request.method == 'POST':
        data = {
            'title': request.POST.get('title'),
            'author': request.POST.get('author'),
            'price': request.POST.get('price'),
            'stock': request.POST.get('stock'),
        }
        try:
            requests.post('http://book-service:8000/books/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/books-ui/')

    books = []
    try:
        r = requests.get('http://book-service:8000/books/', timeout=3)
        if r.status_code == 200:
            books = r.json()
    except requests.RequestException:
        books = []
    return render(request, 'books.html', {'books': books})


def cart_ui(request, customer_id):
    if request.method == 'POST':
        data = {
            'cart': customer_id,
            'book_id': request.POST.get('book_id'),
            'quantity': request.POST.get('quantity'),
        }
        try:
            requests.post('http://cart-service:8000/cart-items/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect(f'/cart-ui/{customer_id}/')

    items = []
    try:
        r = requests.get(f'http://cart-service:8000/carts/{customer_id}/', timeout=3)
        if r.status_code == 200:
            items = r.json()
    except requests.RequestException:
        items = []
    return render(request, 'cart.html', {'items': items, 'customer_id': customer_id})


def orders_ui(request, customer_id):
    if request.method == 'POST':
        data = {
            'customer_id': customer_id,
        }
        try:
            requests.post('http://order-service:8000/orders/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect(f'/orders-ui/{customer_id}/')

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
    if request.method == 'POST':
        data = {
            'customer_id': request.POST.get('customer_id'),
            'book_id': book_id,
            'rating': request.POST.get('rating'),
            'comment': request.POST.get('comment'),
        }
        try:
            requests.post('http://comment-rate-service:8000/reviews/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect(f'/reviews-ui/{book_id}/')

    reviews = []
    try:
        r = requests.get(f'http://comment-rate-service:8000/reviews/book/{book_id}/', timeout=3)
        if r.status_code == 200:
            reviews = r.json()
    except requests.RequestException:
        reviews = []
    return render(request, 'reviews.html', {'reviews': reviews, 'book_id': book_id})


def managers_ui(request):
    if request.method == 'POST':
        data = {
            'name': request.POST.get('name'),
            'email': request.POST.get('email'),
        }
        try:
            requests.post('http://manager-service:8000/managers/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/managers-ui/')

    managers = []
    try:
        r = requests.get('http://manager-service:8000/managers/', timeout=3)
        if r.status_code == 200:
            managers = r.json()
    except requests.RequestException:
        managers = []
    return render(request, 'managers.html', {'managers': managers})


def categories_ui(request):
    if request.method == 'POST':
        data = {
            'name': request.POST.get('name'),
        }
        try:
            requests.post('http://catalog-service:8000/categories/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/categories-ui/')

    categories = []
    try:
        r = requests.get('http://catalog-service:8000/categories/', timeout=3)
        if r.status_code == 200:
            categories = r.json()
    except requests.RequestException:
        categories = []
    return render(request, 'categories.html', {'categories': categories})


def customers_ui(request):
    if request.method == 'POST':
        data = {
            'name': request.POST.get('name'),
            'email': request.POST.get('email'),
        }
        try:
            requests.post('http://customer-service:8000/customers/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/customers-ui/')

    customers = []
    try:
        r = requests.get('http://customer-service:8000/customers/', timeout=3)
        if r.status_code == 200:
            customers = r.json()
    except requests.RequestException:
        customers = []
    return render(request, 'customers.html', {'customers': customers})


def shipments_ui(request, order_id):
    shipments = []
    try:
        r = requests.get(f'http://ship-service:8000/shipments/{order_id}/', timeout=3)
        if r.status_code == 200:
            shipments = r.json()
    except requests.RequestException:
        shipments = []
    return render(request, 'shipments.html', {'shipments': shipments, 'order_id': order_id})


def recommendations_ui(request):
    recommendations = []
    try:
        r = requests.get('http://recommender-ai-service:8000/recommendations/', timeout=3)
        if r.status_code == 200:
            recommendations = r.json()
    except requests.RequestException:
        recommendations = []
    return render(request, 'recommendations.html', {'recommendations': recommendations})


def staff_ui(request):
    if request.method == 'POST':
        data = {
            'title': request.POST.get('title'),
            'author': request.POST.get('author'),
            'price': request.POST.get('price'),
            'stock': request.POST.get('stock'),
        }
        try:
            requests.post('http://staff-service:8000/staff/books/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/staff-ui/')

    books = []
    try:
        r = requests.get('http://staff-service:8000/staff/books/', timeout=3)
        if r.status_code == 200:
            books = r.json()
    except requests.RequestException:
        books = []
    return render(request, 'staff.html', {'books': books})


def staff_delete_book_ui(request, book_id):
    if request.method == 'POST':
        try:
            requests.delete(f'http://staff-service:8000/staff/books/{book_id}/', timeout=3)
        except requests.RequestException:
            pass
    return redirect('/staff-ui/')

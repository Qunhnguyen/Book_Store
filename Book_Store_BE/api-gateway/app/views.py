import logging
import time
import requests
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt

from .circuit_breaker import CircuitBreakerOpen, get_breaker

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 5

BOOK_SERVICE_URL = 'http://book-service:8000'
CART_SERVICE_URL = 'http://cart-service:8000'
CUSTOMER_SERVICE_URL = 'http://customer-service:8000'
ORDER_SERVICE_URL = 'http://order-service:8000'
PAY_SERVICE_URL = 'http://pay-service:8000'
SHIP_SERVICE_URL = 'http://ship-service:8000'
COMMENT_RATE_SERVICE_URL = 'http://comment-rate-service:8000'
MANAGER_SERVICE_URL = 'http://manager-service:8000'
CATALOG_SERVICE_URL = 'http://catalog-service:8000'
STAFF_SERVICE_URL = 'http://staff-service:8000'
RECOMMENDER_AI_SERVICE_URL = 'http://recommender-ai-service:8000'

# Simple in-process counters for /metrics
_request_count = 0
_error_count = 0


def _extract_service_name(service_url: str) -> str:
    """Extract a short service name from the URL for circuit breaker keying."""
    # e.g. 'http://book-service:8000' → 'book-service'
    return service_url.split('//')[1].split(':')[0]


def _forward_request(request, service_url, upstream_path):
    global _request_count, _error_count

    service_name = _extract_service_name(service_url)
    breaker = get_breaker(service_name)

    headers = {}
    content_type = request.headers.get('Content-Type')
    accept = request.headers.get('Accept')

    if content_type:
        headers['Content-Type'] = content_type
    if accept:
        headers['Accept'] = accept

    # Inject User Information from JWT verification metadata
    if 'HTTP_X_USER_ID' in request.META:
        headers['X-User-Id'] = request.META['HTTP_X_USER_ID']
    if 'HTTP_X_USER_EMAIL' in request.META:
        headers['X-User-Email'] = request.META['HTTP_X_USER_EMAIL']

    _request_count += 1
    start_time = time.time()

    try:
        with breaker:
            response = requests.request(
                method=request.method,
                url=f'{service_url}{upstream_path}',
                params=request.GET,
                data=request.body or None,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
    except CircuitBreakerOpen:
        _error_count += 1
        logger.warning(
            "circuit_open service=%s method=%s path=%s duration_ms=0",
            service_name, request.method, upstream_path,
        )
        return JsonResponse({'error': f'Service {service_name} is temporarily unavailable (circuit open)'}, status=503)
    except requests.RequestException as exc:
        _error_count += 1
        duration_ms = int((time.time() - start_time) * 1000)
        logger.error(
            "upstream_error service=%s method=%s path=%s duration_ms=%d error=%s",
            service_name, request.method, upstream_path, duration_ms, exc,
        )
        return JsonResponse({'error': 'Cannot reach upstream service'}, status=503)

    duration_ms = int((time.time() - start_time) * 1000)
    logger.info(
        "proxy service=%s method=%s path=%s status=%d duration_ms=%d",
        service_name, request.method, upstream_path, response.status_code, duration_ms,
    )

    response_content_type = response.headers.get('Content-Type', 'application/json')
    return HttpResponse(
        content=response.content,
        status=response.status_code,
        content_type=response_content_type,
    )


# ---------------------------------------------------------------------------
# Observability endpoints
# ---------------------------------------------------------------------------

def health_check(request):
    """GET /api/health/ — liveness probe, no JWT required."""
    return JsonResponse({'status': 'ok', 'service': 'api-gateway'})


def metrics_view(request):
    """GET /api/metrics/ — Prometheus text format, no JWT required."""
    lines = [
        '# HELP gateway_requests_total Total HTTP requests proxied by api-gateway',
        '# TYPE gateway_requests_total counter',
        f'gateway_requests_total {_request_count}',
        '# HELP gateway_errors_total Total upstream errors seen by api-gateway',
        '# TYPE gateway_errors_total counter',
        f'gateway_errors_total {_error_count}',
    ]
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; version=0.0.4')


@csrf_exempt
def books_api(request):
    return _forward_request(request, BOOK_SERVICE_URL, '/books/')


@csrf_exempt
def book_detail_api(request, book_id):
    return _forward_request(request, BOOK_SERVICE_URL, f'/books/{book_id}/')


@csrf_exempt
def customers_api(request):
    return _forward_request(request, CUSTOMER_SERVICE_URL, '/customers/')


@csrf_exempt
def customer_register_api(request):
    return _forward_request(request, CUSTOMER_SERVICE_URL, '/customers/')


@csrf_exempt
def customer_login_api(request):
    return _forward_request(request, CUSTOMER_SERVICE_URL, '/login/')


@csrf_exempt
def carts_api(request):
    return _forward_request(request, CART_SERVICE_URL, '/carts/')


@csrf_exempt
def cart_by_customer_api(request, customer_id):
    return _forward_request(request, CART_SERVICE_URL, f'/carts/{customer_id}/')


@csrf_exempt
def cart_items_api(request):
    return _forward_request(request, CART_SERVICE_URL, '/cart-items/')


@csrf_exempt
def cart_item_detail_api(request, item_id):
    return _forward_request(request, CART_SERVICE_URL, f'/cart-items/{item_id}/')


@csrf_exempt
def orders_api(request):
    return _forward_request(request, ORDER_SERVICE_URL, '/orders/')


@csrf_exempt
def customer_orders_api(request, customer_id):
    return _forward_request(request, ORDER_SERVICE_URL, f'/orders/{customer_id}/')


@csrf_exempt
def payments_api(request):
    return _forward_request(request, PAY_SERVICE_URL, '/payments/')


@csrf_exempt
def payments_by_order_api(request, order_id):
    return _forward_request(request, PAY_SERVICE_URL, f'/payments/{order_id}/')


@csrf_exempt
def shipments_api(request):
    return _forward_request(request, SHIP_SERVICE_URL, '/shipments/')


@csrf_exempt
def shipments_by_order_api(request, order_id):
    return _forward_request(request, SHIP_SERVICE_URL, f'/shipments/{order_id}/')


@csrf_exempt
def reviews_api(request):
    return _forward_request(request, COMMENT_RATE_SERVICE_URL, '/reviews/')


@csrf_exempt
def reviews_by_book_api(request, book_id):
    return _forward_request(request, COMMENT_RATE_SERVICE_URL, f'/reviews/book/{book_id}/')


@csrf_exempt
def managers_api(request):
    return _forward_request(request, MANAGER_SERVICE_URL, '/managers/')


@csrf_exempt
def categories_api(request):
    return _forward_request(request, CATALOG_SERVICE_URL, '/categories/')


@csrf_exempt
def staff_books_api(request):
    return _forward_request(request, STAFF_SERVICE_URL, '/staff/books/')


@csrf_exempt
def staff_book_detail_api(request, book_id):
    return _forward_request(request, STAFF_SERVICE_URL, f'/staff/books/{book_id}/')


@csrf_exempt
def recommendations_api(request):
    return _forward_request(request, RECOMMENDER_AI_SERVICE_URL, '/recommendations/')


@csrf_exempt
def payment_process_api(request, payment_id):
    """PATCH /api/payments/{payment_id}/process/ - Forward to pay-service"""
    return _forward_request(request, PAY_SERVICE_URL, f'/payments/{payment_id}/process/')


@csrf_exempt
def shipment_deliver_api(request, shipment_id):
    """PATCH /api/shipments/{shipment_id}/deliver/ - Forward to ship-service"""
    return _forward_request(request, SHIP_SERVICE_URL, f'/shipments/{shipment_id}/deliver/')


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
            requests.post(f'{BOOK_SERVICE_URL}/books/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/books-ui/')

    books = []
    try:
        r = requests.get(f'{BOOK_SERVICE_URL}/books/', timeout=3)
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
            requests.post(f'{CART_SERVICE_URL}/cart-items/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect(f'/cart-ui/{customer_id}/')

    items = []
    try:
        r = requests.get(f'{CART_SERVICE_URL}/carts/{customer_id}/', timeout=3)
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
            requests.post(f'{ORDER_SERVICE_URL}/orders/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect(f'/orders-ui/{customer_id}/')

    orders = []
    try:
        r = requests.get(f'{ORDER_SERVICE_URL}/orders/{customer_id}/', timeout=3)
        if r.status_code == 200:
            orders = r.json()
    except requests.RequestException:
        orders = []
    return render(request, 'orders.html', {'orders': orders, 'customer_id': customer_id})


def payments_ui(request, order_id):
    payments = []
    try:
        r = requests.get(f'{PAY_SERVICE_URL}/payments/{order_id}/', timeout=3)
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
            requests.post(f'{COMMENT_RATE_SERVICE_URL}/reviews/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect(f'/reviews-ui/{book_id}/')

    reviews = []
    try:
        r = requests.get(f'{COMMENT_RATE_SERVICE_URL}/reviews/book/{book_id}/', timeout=3)
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
            requests.post(f'{MANAGER_SERVICE_URL}/managers/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/managers-ui/')

    managers = []
    try:
        r = requests.get(f'{MANAGER_SERVICE_URL}/managers/', timeout=3)
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
            requests.post(f'{CATALOG_SERVICE_URL}/categories/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/categories-ui/')

    categories = []
    try:
        r = requests.get(f'{CATALOG_SERVICE_URL}/categories/', timeout=3)
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
            requests.post(f'{CUSTOMER_SERVICE_URL}/customers/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/customers-ui/')

    customers = []
    try:
        r = requests.get(f'{CUSTOMER_SERVICE_URL}/customers/', timeout=3)
        if r.status_code == 200:
            customers = r.json()
    except requests.RequestException:
        customers = []
    return render(request, 'customers.html', {'customers': customers})


def shipments_ui(request, order_id):
    shipments = []
    try:
        r = requests.get(f'{SHIP_SERVICE_URL}/shipments/{order_id}/', timeout=3)
        if r.status_code == 200:
            shipments = r.json()
    except requests.RequestException:
        shipments = []
    return render(request, 'shipments.html', {'shipments': shipments, 'order_id': order_id})


def recommendations_ui(request):
    recommendations = []
    try:
        r = requests.get(f'{RECOMMENDER_AI_SERVICE_URL}/recommendations/', timeout=3)
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
            requests.post(f'{STAFF_SERVICE_URL}/staff/books/', json=data, timeout=3)
        except requests.RequestException:
            pass
        return redirect('/staff-ui/')

    books = []
    try:
        r = requests.get(f'{STAFF_SERVICE_URL}/staff/books/', timeout=3)
        if r.status_code == 200:
            books = r.json()
    except requests.RequestException:
        books = []
    return render(request, 'staff.html', {'books': books})


def staff_delete_book_ui(request, book_id):
    if request.method == 'POST':
        try:
            requests.delete(f'{STAFF_SERVICE_URL}/staff/books/{book_id}/', timeout=3)
        except requests.RequestException:
            pass
    return redirect('/staff-ui/')

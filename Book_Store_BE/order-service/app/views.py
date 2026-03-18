import logging
import requests
import uuid
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .events import publish_event
from .models import Order, OrderItem
from .serializers import OrderSerializer

logger = logging.getLogger(__name__)

CART_SERVICE_URL = "http://cart-service:8000"
PAY_SERVICE_URL = "http://pay-service:8000"
SHIP_SERVICE_URL = "http://ship-service:8000"
BOOK_SERVICE_URL = "http://book-service:8000"


class OrderListCreate(APIView):
    def get(self, request):
        orders = Order.objects.all().order_by("id")
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        customer_id = request.data.get("customer_id")
        force_payment_failure = request.data.get("force_payment_failure", False)
        force_shipping_failure = request.data.get("force_shipping_failure", False)
        if customer_id is None:
            return Response({"error": "customer_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer_id = int(customer_id)
        except (TypeError, ValueError):
            return Response({"error": "customer_id must be integer"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            r = requests.get(f"{CART_SERVICE_URL}/carts/{customer_id}/", timeout=3)
            r.raise_for_status()
            cart_items = r.json()
        except requests.RequestException:
            return Response({"error": "Cannot reach cart-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not isinstance(cart_items, list) or len(cart_items) == 0:
            return Response({"error": "Cart is empty"}, status=status.HTTP_400_BAD_REQUEST)

        # Get book prices first to calculate total and verify they exist before creating Order
        book_ids = list(set([item.get("book_id") for item in cart_items if isinstance(item, dict) and item.get("book_id")]))
        book_prices = {}
        if book_ids:
            try:
                # Assuming book-service returns all books. We filter here.
                # In a real app we might want a bulk endpoint.
                r_books = requests.get(f"{BOOK_SERVICE_URL}/books/", timeout=5)
                r_books.raise_for_status()
                all_books = r_books.json()
                for bk in all_books:
                    if bk.get("id") in book_ids:
                        book_prices[bk.get("id")] = float(bk.get("price", 0))
            except requests.RequestException:
                pass


        order_items_to_create = []
        total_price = 0.0

        for item in cart_items:
            if not isinstance(item, dict):
                continue

            book_id = item.get("book_id")
            quantity = item.get("quantity")

            try:
                book_id = int(book_id)
                quantity = int(quantity)
            except (TypeError, ValueError):
                continue

            if quantity <= 0:
                continue
            
            # calculate total price
            price = book_prices.get(book_id, 0.0)
            total_price += price * quantity
            order_items_to_create.append({"book_id": book_id, "quantity": quantity})

        if not order_items_to_create:
            return Response({"error": "No valid cart items"}, status=status.HTTP_400_BAD_REQUEST)

        saga_id = str(uuid.uuid4())
        correlation_id = str(uuid.uuid4())
        
        # Create Order
        order = Order.objects.create(
            customer_id=customer_id, 
            status="PENDING", 
            total_price=total_price,
            saga_id=saga_id,
            correlation_id=correlation_id
        )

        # Create OrderItems
        order_items_db = [
            OrderItem(order=order, book_id=item["book_id"], quantity=item["quantity"])
            for item in order_items_to_create
        ]
        OrderItem.objects.bulk_create(order_items_db)

        # Deduct book stock
        try:
            requests.post(f"{BOOK_SERVICE_URL}/books/deduct-stock/", json={"items": order_items_to_create}, timeout=5)
        except requests.RequestException:
            pass
        
        # Clear the cart
        try:
            requests.delete(f"{CART_SERVICE_URL}/carts/{customer_id}/", timeout=3)
        except requests.RequestException:
            pass

        # Publish Event
        payload = {
            "order_id": order.id,
            "customer_id": customer_id,
            "total_price": float(total_price),
            "items": order_items_to_create,
            "force_payment_failure": force_payment_failure,
            "force_shipping_failure": force_shipping_failure
        }
        publish_event("payment.reserve.requested", payload, correlation_id=correlation_id, saga_id=saga_id)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrderList(APIView):
    def get(self, request, customer_id):
        orders = Order.objects.filter(customer_id=customer_id).order_by("id")
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrderUpdateStatus(APIView):
    def patch(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        new_status = request.data.get("status")
        if new_status:
            order.status = str(new_status)
            order.save(update_fields=["status"])
            return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)
        return Response({"error": "status is required"}, status=status.HTTP_400_BAD_REQUEST)


def health_check(request):
    """GET /health/ — liveness probe."""
    return JsonResponse({'status': 'ok', 'service': 'order-service'})


def metrics_view(request):
    """GET /metrics/ — Prometheus text format."""
    total = Order.objects.count()
    confirmed = Order.objects.filter(status='CONFIRMED').count()
    cancelled = Order.objects.filter(status='CANCELLED').count()
    pending = Order.objects.filter(status='PENDING').count()
    lines = [
        '# HELP order_total Total number of orders',
        '# TYPE order_total gauge',
        f'order_total {total}',
        f'order_status_count{{status="CONFIRMED"}} {confirmed}',
        f'order_status_count{{status="CANCELLED"}} {cancelled}',
        f'order_status_count{{status="PENDING"}} {pending}',
    ]
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; version=0.0.4')

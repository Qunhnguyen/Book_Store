import logging
import uuid
from decimal import Decimal, InvalidOperation

import requests
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .events import publish_event
from .models import Order, OrderItem
from .serializers import OrderSerializer

logger = logging.getLogger(__name__)

CART_SERVICE_URL = 'http://cart-service:8000'
BOOK_SERVICE_URL = 'http://book-service:8000'


def _fetch_book_prices(book_ids):
    if not book_ids:
        return {}, None

    try:
        response = requests.get(f'{BOOK_SERVICE_URL}/books/', timeout=5)
        response.raise_for_status()
        all_books = response.json()
    except requests.RequestException:
        return {}, Response({'error': 'Cannot reach book-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    if not isinstance(all_books, list):
        return {}, Response({'error': 'Invalid response from book-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    requested_ids = [int(book_id) for book_id in book_ids]
    requested_id_set = set(requested_ids)
    book_prices = {}
    invalid_price_book_ids = []

    for book in all_books:
        if not isinstance(book, dict):
            continue
        book_id = book.get('id')
        if book_id not in requested_id_set:
            continue

        try:
            normalized_book_id = int(book_id)
            book_prices[normalized_book_id] = Decimal(str(book.get('price')))
        except (TypeError, ValueError, InvalidOperation):
            invalid_price_book_ids.append(book_id)

    if invalid_price_book_ids:
        return {}, Response(
            {'error': 'Some books have invalid pricing data', 'invalid_price_book_ids': invalid_price_book_ids},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    missing_book_ids = [book_id for book_id in requested_ids if book_id not in book_prices]
    if missing_book_ids:
        return {}, Response(
            {'error': 'Some books are unavailable', 'missing_book_ids': missing_book_ids},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return book_prices, None


class OrderListCreate(APIView):
    def get(self, request):
        orders = Order.objects.all().order_by('id')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        customer_id = request.data.get('customer_id')
        force_payment_failure = request.data.get('force_payment_failure', False)
        force_shipping_failure = request.data.get('force_shipping_failure', False)
        if customer_id is None:
            return Response({'error': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer_id = int(customer_id)
        except (TypeError, ValueError):
            return Response({'error': 'customer_id must be integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            response = requests.get(f'{CART_SERVICE_URL}/carts/{customer_id}/', timeout=3)
            response.raise_for_status()
            cart_items = response.json()
        except requests.RequestException:
            return Response({'error': 'Cannot reach cart-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not isinstance(cart_items, list) or len(cart_items) == 0:
            return Response({'error': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

        book_ids = list({
            item.get('book_id')
            for item in cart_items
            if isinstance(item, dict) and item.get('book_id')
        })
        book_prices, error_response = _fetch_book_prices(book_ids)
        if error_response is not None:
            return error_response

        order_items_to_create = []
        total_price = Decimal('0')

        for item in cart_items:
            if not isinstance(item, dict):
                continue

            book_id = item.get('book_id')
            quantity = item.get('quantity')

            try:
                book_id = int(book_id)
                quantity = int(quantity)
            except (TypeError, ValueError):
                continue

            if quantity <= 0:
                continue

            price = book_prices.get(book_id)
            if price is None:
                return Response(
                    {'error': 'Some books are unavailable', 'missing_book_ids': [book_id]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            total_price += price * quantity
            order_items_to_create.append({'book_id': book_id, 'quantity': quantity})

        if not order_items_to_create:
            return Response({'error': 'No valid cart items'}, status=status.HTTP_400_BAD_REQUEST)

        saga_id = str(uuid.uuid4())
        correlation_id = str(uuid.uuid4())
        payload = {
            'customer_id': customer_id,
            'total_price': float(total_price),
            'items': order_items_to_create,
            'force_payment_failure': force_payment_failure,
            'force_shipping_failure': force_shipping_failure,
        }

        try:
            with transaction.atomic():
                order = Order.objects.create(
                    customer_id=customer_id,
                    status='PENDING',
                    total_price=total_price,
                    saga_id=saga_id,
                    correlation_id=correlation_id,
                )

                OrderItem.objects.bulk_create([
                    OrderItem(order=order, book_id=item['book_id'], quantity=item['quantity'])
                    for item in order_items_to_create
                ])

                payload['order_id'] = order.id
                published, _ = publish_event(
                    'inventory.reserve.requested',
                    payload,
                    correlation_id=correlation_id,
                    saga_id=saga_id,
                )
                if not published:
                    raise RuntimeError('Failed to publish inventory.reserve.requested')
        except RuntimeError as exc:
            logger.error('order_create_publish_failed customer_id=%s saga_id=%s error=%s', customer_id, saga_id, exc)
            return Response({'error': 'Cannot start inventory saga'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            logger.exception('order_create_failed customer_id=%s saga_id=%s error=%s', customer_id, saga_id, exc)
            return Response({'error': 'Cannot create order'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrderList(APIView):
    def get(self, request, customer_id):
        orders = Order.objects.filter(customer_id=customer_id).order_by('id')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrderUpdateStatus(APIView):
    def patch(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        new_status = request.data.get('status')
        if new_status:
            order.status = str(new_status)
            order.save(update_fields=['status'])
            return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)
        return Response({'error': 'status is required'}, status=status.HTTP_400_BAD_REQUEST)


def health_check(request):
    return JsonResponse({'status': 'ok', 'service': 'order-service'})


def metrics_view(request):
    total = Order.objects.count()
    confirmed = Order.objects.filter(status='CONFIRMED').count()
    cancelled = Order.objects.filter(status='CANCELLED').count()
    failed = Order.objects.filter(status='FAILED').count()
    pending = Order.objects.filter(status='PENDING').count()
    inventory_reserved = Order.objects.filter(status='INVENTORY_RESERVED').count()
    payment_reserved = Order.objects.filter(status='PAYMENT_RESERVED').count()
    lines = [
        '# HELP order_total Total number of orders',
        '# TYPE order_total gauge',
        f'order_total {total}',
        f'order_status_count{{status="CONFIRMED"}} {confirmed}',
        f'order_status_count{{status="CANCELLED"}} {cancelled}',
        f'order_status_count{{status="FAILED"}} {failed}',
        f'order_status_count{{status="PENDING"}} {pending}',
        f'order_status_count{{status="INVENTORY_RESERVED"}} {inventory_reserved}',
        f'order_status_count{{status="PAYMENT_RESERVED"}} {payment_reserved}',
    ]
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; version=0.0.4')

from django.db import transaction
from django.http import HttpResponse, JsonResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InventoryItem, InventoryReservation
from .serializers import InventoryItemSerializer


def _parse_book_ids(raw_value):
    if not raw_value:
        return None, None

    book_ids = []
    try:
        for raw_book_id in raw_value.split(','):
            raw_book_id = raw_book_id.strip()
            if not raw_book_id:
                continue
            book_id = int(raw_book_id)
            if book_id not in book_ids:
                book_ids.append(book_id)
    except ValueError:
        return None, Response(
            {'error': 'book_ids must be a comma-separated list of integers'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return book_ids, None


class InventoryItemList(APIView):
    def get(self, request):
        raw_book_ids = request.GET.get('book_ids')
        book_ids, error_response = _parse_book_ids(raw_book_ids)
        if error_response is not None:
            return error_response

        items = InventoryItem.objects.all().order_by('book_id')
        if book_ids is not None:
            items_by_book_id = {item.book_id: item for item in items.filter(book_id__in=book_ids)}
            ordered_items = [items_by_book_id[book_id] for book_id in book_ids if book_id in items_by_book_id]
            return Response(InventoryItemSerializer(ordered_items, many=True).data, status=status.HTTP_200_OK)

        return Response(InventoryItemSerializer(items, many=True).data, status=status.HTTP_200_OK)


class InventoryItemDetail(APIView):
    def get(self, request, book_id):
        try:
            item = InventoryItem.objects.get(book_id=book_id)
        except InventoryItem.DoesNotExist:
            return Response({'error': 'Inventory item not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(InventoryItemSerializer(item).data, status=status.HTTP_200_OK)

    def put(self, request, book_id):
        stock = request.data.get('stock')
        try:
            stock = int(stock)
        except (TypeError, ValueError):
            return Response({'error': 'stock must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        if stock < 0:
            return Response({'error': 'stock must be non-negative'}, status=status.HTTP_400_BAD_REQUEST)

        item, _ = InventoryItem.objects.get_or_create(
            book_id=book_id,
            defaults={'available_qty': stock, 'reserved_qty': 0},
        )
        if item.available_qty != stock:
            item.available_qty = stock
            item.save(update_fields=['available_qty'])

        return Response(InventoryItemSerializer(item).data, status=status.HTTP_200_OK)

    def delete(self, request, book_id):
        item = InventoryItem.objects.filter(book_id=book_id).first()
        if item is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if item.reserved_qty > 0:
            return Response(
                {'error': 'Cannot delete inventory while reservations are active'},
                status=status.HTTP_409_CONFLICT,
            )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InventoryDeductStock(APIView):
    def post(self, request):
        items = request.data.get('items', [])
        normalized_items = []
        try:
            for item in items:
                book_id = int(item.get('book_id'))
                quantity = int(item.get('quantity'))
                if quantity <= 0:
                    raise ValueError
                normalized_items.append({'book_id': book_id, 'quantity': quantity})
        except (AttributeError, TypeError, ValueError):
            return Response({'error': 'items must contain positive integer book_id and quantity'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            locked_items = {
                item.book_id: item
                for item in InventoryItem.objects.select_for_update().filter(
                    book_id__in=[normalized_item['book_id'] for normalized_item in normalized_items]
                )
            }

            missing_book_ids = [
                normalized_item['book_id']
                for normalized_item in normalized_items
                if normalized_item['book_id'] not in locked_items
            ]
            if missing_book_ids:
                return Response(
                    {'error': 'Inventory item not found', 'missing_book_ids': missing_book_ids},
                    status=status.HTTP_404_NOT_FOUND,
                )

            for normalized_item in normalized_items:
                inventory_item = locked_items[normalized_item['book_id']]
                if inventory_item.available_qty < normalized_item['quantity']:
                    return Response(
                        {'error': f"Not enough stock for book {normalized_item['book_id']}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            for normalized_item in normalized_items:
                inventory_item = locked_items[normalized_item['book_id']]
                inventory_item.available_qty -= normalized_item['quantity']
                inventory_item.save(update_fields=['available_qty'])

        return Response({'message': 'Stock deducted successfully'}, status=status.HTTP_200_OK)


def health_check(request):
    return JsonResponse({'status': 'ok', 'service': 'inventory-service'})


def metrics_view(request):
    total_items = InventoryItem.objects.count()
    total_available = sum(item.available_qty for item in InventoryItem.objects.all())
    total_reserved = sum(item.reserved_qty for item in InventoryItem.objects.all())
    reservations = InventoryReservation.objects.count()
    lines = [
        '# HELP inventory_items_total Total tracked inventory items',
        '# TYPE inventory_items_total gauge',
        f'inventory_items_total {total_items}',
        '# HELP inventory_available_total Sum of available inventory',
        '# TYPE inventory_available_total gauge',
        f'inventory_available_total {total_available}',
        '# HELP inventory_reserved_total Sum of reserved inventory',
        '# TYPE inventory_reserved_total gauge',
        f'inventory_reserved_total {total_reserved}',
        '# HELP inventory_reservations_total Total inventory reservations',
        '# TYPE inventory_reservations_total gauge',
        f'inventory_reservations_total {reservations}',
    ]
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; version=0.0.4')

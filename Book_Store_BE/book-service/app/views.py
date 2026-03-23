import os

import requests
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, BookCategoryLink, ImageStatusChoices
from .serializers import BookImagePatchSerializer, BookSerializer

CATALOG_SERVICE_URL = os.environ.get('CATALOG_SERVICE_URL', 'http://catalog-service:8000')
INVENTORY_SERVICE_URL = os.environ.get('INVENTORY_SERVICE_URL', 'http://inventory-service:8000')


class CatalogServiceUnavailable(Exception):
    pass


class InventoryServiceUnavailable(Exception):
    pass


def _enqueue_image_task(book):
    """Send process_book_image_task to image-service Celery queue."""
    try:
        from celery import Celery
        broker = os.environ.get('CELERY_BROKER_URL', 'redis://redis:6379/0')
        app = Celery(broker=broker)
        app.send_task(
            'app.tasks.process_book_image_task',
            args=[],
            kwargs={
                'book_id': book.id,
                'title': book.title,
                'author': book.author,
                'isbn': book.isbn or '',
            },
        )
        book.image_status = ImageStatusChoices.PENDING
        book.save(update_fields=['image_status'])
    except Exception:
        # Never let Celery errors break the main create flow
        pass


def _fetch_categories_by_ids(category_ids, fail_silently=False):
    if not category_ids:
        return {}

    try:
        response = requests.get(
            f'{CATALOG_SERVICE_URL}/categories/',
            params={'ids': ','.join(str(category_id) for category_id in category_ids)},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException:
        if fail_silently:
            return {}
        raise CatalogServiceUnavailable()

    categories = response.json()
    return {
        category['id']: {'id': category['id'], 'name': category['name']}
        for category in categories
        if isinstance(category, dict) and 'id' in category and 'name' in category
    }


def _fetch_inventory_stock_map(book_ids, fail_silently=False):
    if not book_ids:
        return {}

    try:
        response = requests.get(
            f'{INVENTORY_SERVICE_URL}/inventory-items/',
            params={'book_ids': ','.join(str(book_id) for book_id in book_ids)},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException:
        if fail_silently:
            return {}
        raise InventoryServiceUnavailable()

    stock_map = {}
    for item in response.json():
        if not isinstance(item, dict):
            continue
        try:
            book_id = int(item['book_id'])
            available_qty = int(item['available_qty'])
        except (KeyError, TypeError, ValueError):
            continue
        stock_map[book_id] = available_qty
    return stock_map


def _sync_inventory_stock(book_id, stock):
    try:
        response = requests.put(
            f'{INVENTORY_SERVICE_URL}/inventory-items/{book_id}/',
            json={'stock': stock},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise InventoryServiceUnavailable() from exc
    return response.json()


def _delete_inventory_item(book_id):
    try:
        response = requests.delete(f'{INVENTORY_SERVICE_URL}/inventory-items/{book_id}/', timeout=5)
    except requests.RequestException as exc:
        raise InventoryServiceUnavailable() from exc

    if response.status_code in (status.HTTP_204_NO_CONTENT, status.HTTP_404_NOT_FOUND):
        return
    if response.status_code == status.HTTP_409_CONFLICT:
        conflict_payload = response.json() if response.content else {'error': 'Inventory item has active reservations'}
        raise ValueError(conflict_payload.get('error', 'Inventory item has active reservations'))
    if response.status_code >= 400:
        raise InventoryServiceUnavailable()


def _resolve_requested_categories(category_ids):
    ordered_ids = []
    for category_id in category_ids or []:
        category_id = int(category_id)
        if category_id not in ordered_ids:
            ordered_ids.append(category_id)

    category_map = _fetch_categories_by_ids(ordered_ids)
    missing_ids = [category_id for category_id in ordered_ids if category_id not in category_map]
    if missing_ids:
        return ordered_ids, category_map, Response(
            {'error': 'Some categories do not exist', 'missing_category_ids': missing_ids},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return ordered_ids, category_map, None


def _sync_book_categories(book, category_ids):
    desired_ids = set(category_ids)
    BookCategoryLink.objects.filter(book=book).exclude(category_id__in=desired_ids).delete()

    existing_ids = set(
        BookCategoryLink.objects.filter(book=book, category_id__in=desired_ids).values_list('category_id', flat=True)
    )
    new_links = [
        BookCategoryLink(book=book, category_id=category_id)
        for category_id in category_ids
        if category_id not in existing_ids
    ]
    if new_links:
        BookCategoryLink.objects.bulk_create(new_links)


def _attach_categories(books, fail_silently=True):
    books = list(books)
    if not books:
        return books

    book_ids = [book.id for book in books]
    links = list(BookCategoryLink.objects.filter(book_id__in=book_ids).order_by('id'))
    category_ids = []
    book_to_category_ids = {book_id: [] for book_id in book_ids}

    for link in links:
        book_to_category_ids.setdefault(link.book_id, []).append(link.category_id)
        if link.category_id not in category_ids:
            category_ids.append(link.category_id)

    category_map = _fetch_categories_by_ids(category_ids, fail_silently=fail_silently)
    for book in books:
        resolved = []
        for category_id in book_to_category_ids.get(book.id, []):
            category = category_map.get(category_id)
            if category:
                resolved.append(category)
        book.resolved_categories = resolved

    return books


def _attach_inventory_stock(books, fail_silently=True):
    books = list(books)
    if not books:
        return books

    book_ids = [book.id for book in books]
    stock_map = _fetch_inventory_stock_map(book_ids, fail_silently=fail_silently)
    for book in books:
        book.stock = stock_map.get(book.id, book.stock)
    return books


class BookListCreate(APIView):
    def get(self, request):
        books = list(Book.objects.all().order_by('id'))
        _attach_categories(books, fail_silently=True)
        _attach_inventory_stock(books, fail_silently=True)
        return Response(BookSerializer(books, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BookSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        category_ids = serializer.validated_data.pop('category_ids', [])
        try:
            category_ids, category_map, error_response = _resolve_requested_categories(category_ids)
        except CatalogServiceUnavailable:
            return Response({'error': 'Cannot reach catalog-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if error_response is not None:
            return error_response

        try:
            with transaction.atomic():
                book = serializer.save()
                _sync_book_categories(book, category_ids)
                _sync_inventory_stock(book.id, book.stock)
        except InventoryServiceUnavailable:
            return Response({'error': 'Cannot reach inventory-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        book.resolved_categories = [category_map[category_id] for category_id in category_ids]
        _attach_inventory_stock([book], fail_silently=True)
        _enqueue_image_task(book)
        return Response(BookSerializer(book).data, status=status.HTTP_201_CREATED)


class BookDetail(APIView):
    def get(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        _attach_categories([book], fail_silently=True)
        _attach_inventory_stock([book], fail_silently=True)
        return Response(BookSerializer(book).data, status=status.HTTP_200_OK)

    def put(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        serializer = BookSerializer(book, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        category_ids_supplied = 'category_ids' in request.data
        stock_supplied = 'stock' in request.data
        category_ids = []
        category_map = {}
        if category_ids_supplied:
            category_ids = serializer.validated_data.pop('category_ids', [])
            try:
                category_ids, category_map, error_response = _resolve_requested_categories(category_ids)
            except CatalogServiceUnavailable:
                return Response({'error': 'Cannot reach catalog-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if error_response is not None:
                return error_response

        try:
            with transaction.atomic():
                book = serializer.save()
                if category_ids_supplied:
                    _sync_book_categories(book, category_ids)
                if stock_supplied:
                    _sync_inventory_stock(book.id, book.stock)
        except InventoryServiceUnavailable:
            return Response({'error': 'Cannot reach inventory-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if category_ids_supplied:
            book.resolved_categories = [category_map[category_id] for category_id in category_ids]
        else:
            _attach_categories([book], fail_silently=True)
        _attach_inventory_stock([book], fail_silently=True)
        return Response(BookSerializer(book).data, status=status.HTTP_200_OK)

    def patch(self, request, book_id):
        """Used by image-service to update image fields only."""
        book = get_object_or_404(Book, id=book_id)
        serializer = BookImagePatchSerializer(book, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        _attach_categories([book], fail_silently=True)
        _attach_inventory_stock([book], fail_silently=True)
        return Response(BookSerializer(book).data, status=status.HTTP_200_OK)

    def delete(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        try:
            _delete_inventory_item(book.id)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_409_CONFLICT)
        except InventoryServiceUnavailable:
            return Response({'error': 'Cannot reach inventory-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        book.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookRefreshCover(APIView):
    """POST /api/books/<id>/refresh-cover/ - Re-enqueue official cover fetch."""

    def post(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        _enqueue_image_task(book)
        return Response({'status': 'queued', 'book_id': book.id}, status=status.HTTP_202_ACCEPTED)


class BookGenerateAIImage(APIView):
    """POST /api/books/<id>/generate-ai-image/ - Force AI generation ignoring Open Library."""

    def post(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        try:
            from celery import Celery
            broker = os.environ.get('CELERY_BROKER_URL', 'redis://redis:6379/0')
            app = Celery(broker=broker)
            app.send_task(
                'app.tasks.generate_ai_image_task',
                kwargs={'book_id': book.id, 'title': book.title, 'author': book.author},
            )
            book.image_status = ImageStatusChoices.PENDING
            book.save(update_fields=['image_status'])
        except Exception:
            pass
        return Response({'status': 'queued', 'book_id': book.id}, status=status.HTTP_202_ACCEPTED)


class BookRebuildMissingImages(APIView):
    """POST /api/books/rebuild-missing-images/ - Enqueue all books with missing or failed images."""

    def post(self, request):
        qs = Book.objects.filter(
            image_status__in=[
                ImageStatusChoices.NONE,
                ImageStatusChoices.FAILED,
            ]
        )
        queued = []
        for book in qs:
            _enqueue_image_task(book)
            queued.append(book.id)
        return Response({'queued_book_ids': queued, 'count': len(queued)}, status=status.HTTP_202_ACCEPTED)


class BookDeductStock(APIView):
    def post(self, request):
        try:
            response = requests.post(
                f'{INVENTORY_SERVICE_URL}/inventory-items/deduct/',
                json=request.data,
                timeout=5,
            )
        except requests.RequestException:
            return Response({'error': 'Cannot reach inventory-service'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        content = response.json() if response.content else {}
        return Response(content, status=response.status_code)


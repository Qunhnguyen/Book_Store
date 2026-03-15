import os
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, ImageStatusChoices
from .serializers import BookSerializer, BookImagePatchSerializer


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


class BookListCreate(APIView):
    def get(self, request):
        books = Book.objects.all().order_by('id')
        return Response(BookSerializer(books, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BookSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        book = serializer.save()
        _enqueue_image_task(book)
        return Response(BookSerializer(book).data, status=status.HTTP_201_CREATED)


class BookDetail(APIView):
    def get(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        return Response(BookSerializer(book).data, status=status.HTTP_200_OK)

    def put(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        serializer = BookSerializer(book, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, book_id):
        """Used by image-service to update image fields only."""
        book = get_object_or_404(Book, id=book_id)
        serializer = BookImagePatchSerializer(book, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        book.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookRefreshCover(APIView):
    """POST /api/books/<id>/refresh-cover/ — Re-enqueue official cover fetch."""
    def post(self, request, book_id):
        book = get_object_or_404(Book, id=book_id)
        _enqueue_image_task(book)
        return Response({'status': 'queued', 'book_id': book.id}, status=status.HTTP_202_ACCEPTED)


class BookGenerateAIImage(APIView):
    """POST /api/books/<id>/generate-ai-image/ — Force AI generation ignoring Open Library."""
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
    """POST /api/books/rebuild-missing-images/ — Enqueue all books with missing or failed images."""
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

from django.db import transaction

class BookDeductStock(APIView):
    def post(self, request):
        items = request.data.get("items", [])
        with transaction.atomic():
            for item in items:
                book = get_object_or_404(Book, id=item.get("book_id"))
                quantity = item.get("quantity", 0)
                if book.stock < quantity:
                    return Response({"error": f"Not enough stock for book {book.id}"}, status=status.HTTP_400_BAD_REQUEST)
                book.stock -= quantity
                book.save(update_fields=["stock"])
        return Response({"message": "Stock deducted successfully"}, status=status.HTTP_200_OK)

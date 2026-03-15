import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Review
from .serializers import ReviewSerializer

BOOK_SERVICE_URL = "http://book-service:8000"


class ReviewListCreate(APIView):
    def get(self, request):
        reviews = Review.objects.all().order_by("id")
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rating = serializer.validated_data["rating"]
        if rating < 1 or rating > 5:
            return Response({"error": "rating must be between 1 and 5"}, status=status.HTTP_400_BAD_REQUEST)

        book_id = serializer.validated_data["book_id"]

        try:
            r = requests.get(f"{BOOK_SERVICE_URL}/books/", timeout=3)
            r.raise_for_status()
            books = r.json()
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not any(isinstance(book, dict) and book.get("id") == book_id for book in books):
            return Response({"error": "Book not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewByBook(APIView):
    def get(self, request, book_id):
        reviews = Review.objects.filter(book_id=book_id).order_by("id")
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

BOOK_SERVICE_URL = "http://book-service:8000"


class RecommendationList(APIView):
    def get(self, request):
        try:
            r = requests.get(f"{BOOK_SERVICE_URL}/books/", timeout=3)
            r.raise_for_status()
            books = r.json()
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not isinstance(books, list):
            return Response([], status=status.HTTP_200_OK)

        in_stock_books = [
            b for b in books if isinstance(b, dict) and int(b.get("stock", 0)) > 0
        ]

        recommendations = in_stock_books[:5]
        return Response(recommendations, status=status.HTTP_200_OK)

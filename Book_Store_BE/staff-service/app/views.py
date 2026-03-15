import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

BOOK_SERVICE_URL = "http://book-service:8000"


class StaffBookListCreate(APIView):
    def get(self, request):
        try:
            r = requests.get(f"{BOOK_SERVICE_URL}/books/", timeout=3)
            return Response(r.json(), status=r.status_code)
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def post(self, request):
        try:
            r = requests.post(f"{BOOK_SERVICE_URL}/books/", json=request.data, timeout=3)
            return Response(r.json(), status=r.status_code)
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class StaffBookDetail(APIView):
    def put(self, request, book_id):
        try:
            r = requests.put(f"{BOOK_SERVICE_URL}/books/{book_id}/", json=request.data, timeout=3)
            return Response(r.json(), status=r.status_code)
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def delete(self, request, book_id):
        try:
            r = requests.delete(f"{BOOK_SERVICE_URL}/books/{book_id}/", timeout=3)
            if r.status_code == status.HTTP_204_NO_CONTENT:
                return Response(status=status.HTTP_204_NO_CONTENT)
            return Response(r.json(), status=r.status_code)
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

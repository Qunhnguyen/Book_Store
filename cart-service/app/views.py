import requests
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Cart, CartItem
from .serializers import CartItemSerializer, CartSerializer

BOOK_SERVICE_URL = "http://book-service:8000"


class CartCreate(APIView):
    def post(self, request):
        serializer = CartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AddCartItem(APIView):
    def post(self, request):
        serializer = CartItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        book_id = serializer.validated_data["book_id"]

        try:
            r = requests.get(f"{BOOK_SERVICE_URL}/books/", timeout=3)
            r.raise_for_status()
            books = r.json()
        except requests.RequestException:
            return Response({"error": "Cannot reach book-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not any(isinstance(b, dict) and b.get("id") == book_id for b in books):
            return Response({"error": "Book not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ViewCart(APIView):
    def get(self, request, customer_id):
        cart_ids = Cart.objects.filter(customer_id=customer_id).values_list("id", flat=True)
        items = CartItem.objects.filter(cart_id__in=cart_ids).order_by("id")
        serializer = CartItemSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UpdateCartItem(APIView):
    def put(self, request, item_id):
        item = get_object_or_404(CartItem, id=item_id)
        serializer = CartItemSerializer(item, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        quantity = serializer.validated_data.get("quantity")
        if quantity is not None and quantity <= 0:
            return Response({"error": "quantity must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

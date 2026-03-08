import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, OrderItem
from .serializers import OrderSerializer

CART_SERVICE_URL = "http://cart-service:8000"
PAY_SERVICE_URL = "http://pay-service:8000"
SHIP_SERVICE_URL = "http://ship-service:8000"


class OrderListCreate(APIView):
    def get(self, request):
        orders = Order.objects.all().order_by("id")
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        customer_id = request.data.get("customer_id")
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

        order = Order.objects.create(customer_id=customer_id, status="CREATED")

        order_items = []
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

            order_items.append(OrderItem(order=order, book_id=book_id, quantity=quantity))

        if not order_items:
            order.delete()
            return Response({"error": "No valid cart items"}, status=status.HTTP_400_BAD_REQUEST)

        OrderItem.objects.bulk_create(order_items)

        try:
            requests.post(
                f"{PAY_SERVICE_URL}/payments/",
                json={"order_id": order.id, "customer_id": customer_id},
                timeout=3,
            )
        except requests.RequestException:
            pass

        try:
            requests.post(
                f"{SHIP_SERVICE_URL}/shipments/",
                json={"order_id": order.id, "customer_id": customer_id},
                timeout=3,
            )
        except requests.RequestException:
            pass

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrderList(APIView):
    def get(self, request, customer_id):
        orders = Order.objects.filter(customer_id=customer_id).order_by("id")
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

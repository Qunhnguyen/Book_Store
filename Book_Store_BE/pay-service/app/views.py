import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .serializers import PaymentSerializer

ORDER_SERVICE_URL = "http://order-service:8000"


class PaymentListCreate(APIView):
    def get(self, request):
        payments = Payment.objects.all().order_by("id")
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        payload = {
            "order_id": request.data.get("order_id"),
            "payment_method": request.data.get("payment_method", "COD"),
            "status": "PENDING",
        }

        serializer = PaymentSerializer(data=payload)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        order_id = serializer.validated_data["order_id"]

        try:
            r = requests.get(f"{ORDER_SERVICE_URL}/orders/", timeout=3)
            r.raise_for_status()
            orders = r.json()
        except requests.RequestException:
            return Response({"error": "Cannot reach order-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not any(isinstance(order, dict) and order.get("id") == order_id for order in orders):
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer.save()

        # Update order status to PAID
        try:
            requests.patch(f"{ORDER_SERVICE_URL}/orders/{order_id}/status/", json={"status": "PAID"}, timeout=3)
        except requests.RequestException:
            pass

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PaymentByOrder(APIView):
    def get(self, request, order_id):
        payments = Payment.objects.filter(order_id=order_id).order_by("id")
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

import os
import requests
from django.http import HttpResponse, JsonResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .serializers import PaymentSerializer

ORDER_SERVICE_URL = os.environ.get("ORDER_SERVICE_URL", "http://order-service:8000")


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


class PaymentApprove(APIView):
    def post(self, request, order_id):
        is_approved = request.data.get("approved", True)
        payment = Payment.objects.filter(order_id=order_id, status="PENDING").last()
        if not payment:
            return Response({"error": "No PENDING payment found for this order"}, status=status.HTTP_404_NOT_FOUND)
            
        from app.events import publish_event
        if is_approved:
            payment.status = "PAID"
            payment.save(update_fields=["status"])
            
            publish_event(
                "payment.reserve.completed",
                {
                    "order_id": order_id,
                    "success": True,
                    "payment_id": payment.id,
                    "force_shipping_failure": payment.force_shipping_failure,
                },
                correlation_id=payment.correlation_id,
                saga_id=payment.saga_id,
            )
        else:
            payment.status = "FAILED"
            payment.save(update_fields=["status"])
            publish_event(
                "payment.reserve.completed",
                {
                    "order_id": order_id,
                    "success": False,
                    "payment_id": payment.id,
                    "force_shipping_failure": payment.force_shipping_failure,
                },
                correlation_id=payment.correlation_id,
                saga_id=payment.saga_id,
            )
            
        return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)


def health_check(request):
    """GET /health/ — liveness probe."""
    return JsonResponse({'status': 'ok', 'service': 'pay-service'})


def metrics_view(request):
    """GET /metrics/ — Prometheus text format."""
    total = Payment.objects.count()
    paid = Payment.objects.filter(status='PAID').count()
    refunded = Payment.objects.filter(status='REFUNDED').count()
    failed = Payment.objects.filter(status='FAILED').count()
    lines = [
        '# HELP payment_total Total number of payments',
        '# TYPE payment_total gauge',
        f'payment_total {total}',
        f'payment_status_count{{status="PAID"}} {paid}',
        f'payment_status_count{{status="REFUNDED"}} {refunded}',
        f'payment_status_count{{status="FAILED"}} {failed}',
    ]
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; version=0.0.4')

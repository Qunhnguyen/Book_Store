import logging
import requests
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .serializers import PaymentSerializer

logger = logging.getLogger(__name__)

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
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PaymentByOrder(APIView):
    def get(self, request, order_id):
        payments = Payment.objects.filter(order_id=order_id).order_by("id")
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PaymentUpdateProcess(APIView):
    """PATCH /api/payments/{id}/process/ - Client confirms payment (pay or cancel)"""
    def patch(self, request, payment_id):
        from .events import publish_event
        from django.shortcuts import get_object_or_404
        
        try:
            payment = get_object_or_404(Payment, id=payment_id)
        except:
            return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if payment.status != "PENDING":
            return Response(
                {"error": f"Payment is already {payment.status}, cannot be processed"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        action = request.data.get("action", "pay").lower()
        force_failure = request.data.get("force_failure", False)
        
        if action == "pay":
            if force_failure:
                payment.status = "FAILED"
                payment.save()
                logger.warning("payment_process_failed_forced payment_id=%s", payment_id)
                
                # Publish event to cancel order
                publish_event(
                    "payment.failed",
                    {"order_id": payment.order_id, "payment_id": payment.id, "message": "Forced failure"},
                    correlation_id=None,
                    saga_id=None
                )
            else:
                payment.status = "PAID"
                payment.save()
                logger.info("payment_process_paid payment_id=%s order_id=%s", payment_id, payment.order_id)
                
                # Publish event to create shipment
                publish_event(
                    "shipment.create.requested",
                    {"order_id": payment.order_id, "customer_id": None},  # Shipment will fetch order
                    correlation_id=None,
                    saga_id=None
                )
            
            serializer = PaymentSerializer(payment)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif action == "cancel":
            payment.status = "FAILED"
            payment.save()
            logger.info("payment_process_cancelled payment_id=%s", payment_id)
            
            # Publish event to cancel order
            publish_event(
                "payment.failed",
                {"order_id": payment.order_id, "payment_id": payment.id, "message": "Cancelled by client"},
                correlation_id=None,
                saga_id=None
            )
            
            serializer = PaymentSerializer(payment)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        else:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


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

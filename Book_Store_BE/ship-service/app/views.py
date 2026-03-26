import os
import requests
from django.http import HttpResponse, JsonResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Shipment
from .serializers import ShipmentSerializer

ORDER_SERVICE_URL = os.environ.get("ORDER_SERVICE_URL", "http://order-service:8000")


class ShipmentListCreate(APIView):
    def get(self, request):
        shipments = Shipment.objects.all().order_by("id")
        serializer = ShipmentSerializer(shipments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        payload = {
            "order_id": request.data.get("order_id"),
            "shipping_method": request.data.get("shipping_method", "STANDARD"),
            "address": request.data.get("address", ""),
            "status": "PENDING",
        }

        serializer = ShipmentSerializer(data=payload)
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


class ShipmentByOrder(APIView):
    def get(self, request, order_id):
        shipments = Shipment.objects.filter(order_id=order_id).order_by("id")
        serializer = ShipmentSerializer(shipments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ShipmentApprove(APIView):
    def post(self, request, order_id):
        is_approved = request.data.get("approved", True)
        shipment = Shipment.objects.filter(order_id=order_id, status="PENDING").last()
        if not shipment:
            return Response({"error": "No PENDING shipment found for this order"}, status=status.HTTP_404_NOT_FOUND)
            
        from app.events import publish_event
        if is_approved:
            shipment.status = "RESERVED"
            shipment.save(update_fields=["status"])
            
            publish_event(
                "shipping.reserve.completed",
                {
                    "order_id": order_id,
                    "success": True,
                    "shipment_id": shipment.id,
                },
                correlation_id=shipment.correlation_id,
                saga_id=shipment.saga_id,
            )
        else:
            shipment.status = "FAILED"
            shipment.save(update_fields=["status"])
            publish_event(
                "shipping.reserve.completed",
                {
                    "order_id": order_id,
                    "success": False,
                    "shipment_id": shipment.id,
                },
                correlation_id=shipment.correlation_id,
                saga_id=shipment.saga_id,
            )
            
        return Response(ShipmentSerializer(shipment).data, status=status.HTTP_200_OK)


def health_check(request):
    """GET /health/ — liveness probe."""
    return JsonResponse({'status': 'ok', 'service': 'ship-service'})


def metrics_view(request):
    """GET /metrics/ — Prometheus text format."""
    total = Shipment.objects.count()
    reserved = Shipment.objects.filter(status='RESERVED').count()
    cancelled = Shipment.objects.filter(status='CANCELLED').count()
    failed = Shipment.objects.filter(status='FAILED').count()
    lines = [
        '# HELP shipment_total Total number of shipments',
        '# TYPE shipment_total gauge',
        f'shipment_total {total}',
        f'shipment_status_count{{status="RESERVED"}} {reserved}',
        f'shipment_status_count{{status="CANCELLED"}} {cancelled}',
        f'shipment_status_count{{status="FAILED"}} {failed}',
    ]
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain; version=0.0.4')

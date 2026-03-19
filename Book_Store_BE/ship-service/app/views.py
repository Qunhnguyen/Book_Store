import requests
from django.http import HttpResponse, JsonResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Shipment
from .serializers import ShipmentSerializer

ORDER_SERVICE_URL = "http://order-service:8000"


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


class ShipmentUpdateDeliver(APIView):
    """PATCH /api/shipments/{id}/deliver/ - Client confirms delivery (deliver or cancel)"""
    def patch(self, request, shipment_id):
        from .events import publish_event
        from django.shortcuts import get_object_or_404
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            shipment = get_object_or_404(Shipment, id=shipment_id)
        except:
            return Response({"error": "Shipment not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if shipment.status != "PENDING":
            return Response(
                {"error": f"Shipment is already {shipment.status}, cannot be processed"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        action = request.data.get("action", "confirm").lower()
        force_failure = request.data.get("force_failure", False)
        
        if action == "confirm":
            if force_failure:
                shipment.status = "FAILED"
                shipment.save()
                logger.warning("shipment_deliver_failed_forced shipment_id=%s", shipment_id)
                
                # Publish event to trigger compensation (refund)
                publish_event(
                    "payment.compensate.requested",
                    {"order_id": shipment.order_id, "shipment_id": shipment.id, "message": "Forced failure"},
                    correlation_id=None,
                    saga_id=None
                )
            else:
                shipment.status = "DELIVERED"
                shipment.save()
                logger.info("shipment_delivered shipment_id=%s order_id=%s", shipment_id, shipment.order_id)
                
                # Publish event to complete order
                publish_event(
                    "order.complete.requested",
                    {"order_id": shipment.order_id, "shipment_id": shipment.id},
                    correlation_id=None,
                    saga_id=None
                )
            
            serializer = ShipmentSerializer(shipment)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif action == "cancel":
            shipment.status = "FAILED"
            shipment.save()
            logger.info("shipment_cancelled shipment_id=%s", shipment_id)
            
            # Publish event to trigger compensation
            publish_event(
                "payment.compensate.requested",
                {"order_id": shipment.order_id, "shipment_id": shipment.id, "message": "Cancelled by client"},
                correlation_id=None,
                saga_id=None
            )
            
            serializer = ShipmentSerializer(shipment)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        else:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


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

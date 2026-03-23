from django.db import models


class Shipment(models.Model):
    order_id = models.IntegerField()
    shipping_method = models.CharField(max_length=50, default="STANDARD")
    address = models.CharField(max_length=255, default="")
    status = models.CharField(max_length=50, default="PENDING")
    saga_id = models.CharField(max_length=255, null=True, blank=True)
    correlation_id = models.CharField(max_length=255, null=True, blank=True)

class ProcessedEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    processed_at = models.DateTimeField(auto_now_add=True)

from django.db import models


class Payment(models.Model):
    order_id = models.IntegerField()
    payment_method = models.CharField(max_length=50, default="COD")
    status = models.CharField(max_length=50, default="PENDING")
    saga_id = models.CharField(max_length=255, null=True, blank=True)
    correlation_id = models.CharField(max_length=255, null=True, blank=True)
    force_shipping_failure = models.BooleanField(default=False)

class ProcessedEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    processed_at = models.DateTimeField(auto_now_add=True)

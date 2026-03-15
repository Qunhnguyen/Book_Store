from django.db import models


class Shipment(models.Model):
    order_id = models.IntegerField()
    shipping_method = models.CharField(max_length=50, default="STANDARD")
    address = models.CharField(max_length=255, default="")
    status = models.CharField(max_length=50, default="PENDING")

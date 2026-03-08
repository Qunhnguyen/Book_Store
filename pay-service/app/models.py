from django.db import models


class Payment(models.Model):
    order_id = models.IntegerField()
    payment_method = models.CharField(max_length=50, default="COD")
    status = models.CharField(max_length=50, default="PENDING")

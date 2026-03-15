from django.db import models


class Order(models.Model):
    customer_id = models.IntegerField()
    status = models.CharField(max_length=50, default="CREATED")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    book_id = models.IntegerField()
    quantity = models.IntegerField()

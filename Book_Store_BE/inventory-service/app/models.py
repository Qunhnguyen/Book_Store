from django.db import models


class ReservationStatus(models.TextChoices):
    RESERVED = "RESERVED", "Reserved"
    COMMITTED = "COMMITTED", "Committed"
    RELEASED = "RELEASED", "Released"


class InventoryItem(models.Model):
    book_id = models.IntegerField(unique=True)
    available_qty = models.IntegerField(default=0)
    reserved_qty = models.IntegerField(default=0)

    def __str__(self):
        return f"book={self.book_id} available={self.available_qty} reserved={self.reserved_qty}"


class InventoryReservation(models.Model):
    saga_id = models.CharField(max_length=100)
    order_id = models.IntegerField()
    book_id = models.IntegerField()
    quantity = models.IntegerField()
    status = models.CharField(
        max_length=20,
        choices=ReservationStatus.choices,
        default=ReservationStatus.RESERVED,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["saga_id", "book_id"], name="uniq_inventory_reservation"),
        ]


class ProcessedEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    processed_at = models.DateTimeField(auto_now_add=True)

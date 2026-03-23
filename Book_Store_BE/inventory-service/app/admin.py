from django.contrib import admin

from .models import InventoryItem, InventoryReservation, ProcessedEvent

admin.site.register(InventoryItem)
admin.site.register(InventoryReservation)
admin.site.register(ProcessedEvent)

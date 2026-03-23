from django.urls import path

from .views import (
    InventoryDeductStock,
    InventoryItemDetail,
    InventoryItemList,
    health_check,
    metrics_view,
)

urlpatterns = [
    path('health/', health_check),
    path('metrics/', metrics_view),
    path('inventory-items/', InventoryItemList.as_view()),
    path('inventory-items/deduct/', InventoryDeductStock.as_view()),
    path('inventory-items/<int:book_id>/', InventoryItemDetail.as_view()),
]

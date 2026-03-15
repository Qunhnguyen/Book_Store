from django.urls import path

from .views import ShipmentByOrder, ShipmentListCreate

urlpatterns = [
    path("shipments/", ShipmentListCreate.as_view()),
    path("shipments/<int:order_id>/", ShipmentByOrder.as_view()),
]

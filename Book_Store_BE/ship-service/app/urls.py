from django.urls import path

from .views import ShipmentApprove, ShipmentByOrder, ShipmentListCreate, health_check, metrics_view

urlpatterns = [
    path("shipments/", ShipmentListCreate.as_view()),
    path("shipments/<int:order_id>/", ShipmentByOrder.as_view()),
    path("shipments/<int:order_id>/approve/", ShipmentApprove.as_view()),
    path("health/", health_check),
    path("metrics/", metrics_view),
]

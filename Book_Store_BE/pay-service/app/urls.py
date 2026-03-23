from django.urls import path

from .views import PaymentApprove, PaymentByOrder, PaymentListCreate, health_check, metrics_view

urlpatterns = [
    path("payments/", PaymentListCreate.as_view()),
    path("payments/<int:order_id>/", PaymentByOrder.as_view()),
    path("payments/<int:order_id>/approve/", PaymentApprove.as_view()),
    path("health/", health_check),
    path("metrics/", metrics_view),
]

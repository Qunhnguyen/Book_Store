from django.urls import path

from .views import PaymentByOrder, PaymentListCreate, PaymentUpdateProcess, health_check, metrics_view

urlpatterns = [
    path("payments/", PaymentListCreate.as_view()),
    path("payments/<int:order_id>/", PaymentByOrder.as_view()),
    path("payments/<int:payment_id>/process/", PaymentUpdateProcess.as_view()),
    path("health/", health_check),
    path("metrics/", metrics_view),
]

from django.urls import path

from .views import PaymentByOrder, PaymentListCreate

urlpatterns = [
    path("payments/", PaymentListCreate.as_view()),
    path("payments/<int:order_id>/", PaymentByOrder.as_view()),
]

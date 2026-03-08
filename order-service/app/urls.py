from django.urls import path

from .views import CustomerOrderList, OrderListCreate

urlpatterns = [
    path("orders/", OrderListCreate.as_view()),
    path("orders/<int:customer_id>/", CustomerOrderList.as_view()),
]

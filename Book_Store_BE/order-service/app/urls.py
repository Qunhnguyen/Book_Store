from django.urls import path

from .views import CustomerOrderList, OrderListCreate, OrderUpdateStatus

urlpatterns = [
    path("orders/", OrderListCreate.as_view()),
    path("orders/<int:customer_id>/", CustomerOrderList.as_view()),
    path("orders/<int:order_id>/status/", OrderUpdateStatus.as_view()),
]

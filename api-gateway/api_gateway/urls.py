from django.contrib import admin
from django.urls import path

from app.views import (
    home_ui, books_ui, cart_ui, orders_ui, payments_ui,
    reviews_ui, managers_ui, categories_ui, customers_ui,
    shipments_ui, recommendations_ui, staff_ui, staff_delete_book_ui,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home_ui),
    path("books-ui/", books_ui),
    path("cart-ui/<int:customer_id>/", cart_ui),
    path("orders-ui/<int:customer_id>/", orders_ui),
    path("payments-ui/<int:order_id>/", payments_ui),
    path("reviews-ui/<int:book_id>/", reviews_ui),
    path("managers-ui/", managers_ui),
    path("categories-ui/", categories_ui),
    path("customers-ui/", customers_ui),
    path("shipments-ui/<int:order_id>/", shipments_ui),
    path("recommendations-ui/", recommendations_ui),
    path("staff-ui/", staff_ui),
    path("staff-ui/delete/<int:book_id>/", staff_delete_book_ui),
]

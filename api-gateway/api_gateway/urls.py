from django.contrib import admin
from django.urls import path

from app.views import home_ui, books_ui, cart_ui, orders_ui, payments_ui, reviews_ui, managers_ui, categories_ui

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
]

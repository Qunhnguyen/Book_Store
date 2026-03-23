from django.urls import path

from .views import CategoryDetail, CategoryListCreate

urlpatterns = [
    path("categories/", CategoryListCreate.as_view()),
    path("categories/<int:category_id>/", CategoryDetail.as_view()),
]
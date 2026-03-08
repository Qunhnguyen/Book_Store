from django.urls import path
from .views import BookDetail, BookListCreate

urlpatterns = [
    path("books/", BookListCreate.as_view()),
    path("books/<int:book_id>/", BookDetail.as_view()),
]

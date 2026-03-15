from django.urls import path

from .views import ReviewByBook, ReviewListCreate

urlpatterns = [
    path("reviews/", ReviewListCreate.as_view()),
    path("reviews/book/<int:book_id>/", ReviewByBook.as_view()),
]

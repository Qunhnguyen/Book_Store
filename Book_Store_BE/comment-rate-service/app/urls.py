from django.urls import path

from .views import ReviewByBook, ReviewListCreate, ReviewDetail

urlpatterns = [
    path("reviews/", ReviewListCreate.as_view()),
    path("reviews/<int:pk>/", ReviewDetail.as_view()),
    path("reviews/book/<int:book_id>/", ReviewByBook.as_view()),
]

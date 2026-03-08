from django.urls import path
from .views import StaffBookDetail, StaffBookListCreate

urlpatterns = [
    path("staff/books/", StaffBookListCreate.as_view()),
    path("staff/books/<int:book_id>/", StaffBookDetail.as_view()),
]

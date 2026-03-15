from django.urls import path
from .views import (
    BookListCreate,
    BookDetail,
    BookRefreshCover,
    BookGenerateAIImage,
    BookRebuildMissingImages,
    BookDeductStock,
)

urlpatterns = [
    path("books/", BookListCreate.as_view()),
    path("books/rebuild-missing-images/", BookRebuildMissingImages.as_view()),
    path("books/<int:book_id>/", BookDetail.as_view()),
    path("books/<int:book_id>/refresh-cover/", BookRefreshCover.as_view()),
    path("books/<int:book_id>/generate-ai-image/", BookGenerateAIImage.as_view()),
    path("books/deduct-stock/", BookDeductStock.as_view()),
]

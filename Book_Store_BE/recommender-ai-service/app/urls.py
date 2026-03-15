from django.urls import path

from .views import RecommendationList

urlpatterns = [
    path("recommendations/", RecommendationList.as_view()),
]

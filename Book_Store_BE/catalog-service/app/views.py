from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category
from .serializers import CategorySerializer


class CategoryListCreate(APIView):
    def get(self, request):
        ids_param = request.GET.get("ids")
        categories = Category.objects.all().order_by("id")

        if ids_param:
            try:
                requested_ids = []
                for raw_id in ids_param.split(","):
                    raw_id = raw_id.strip()
                    if not raw_id:
                        continue
                    category_id = int(raw_id)
                    if category_id not in requested_ids:
                        requested_ids.append(category_id)
            except ValueError:
                return Response({"error": "ids must be a comma-separated list of integers"}, status=status.HTTP_400_BAD_REQUEST)

            categories_by_id = {
                category.id: category
                for category in categories.filter(id__in=requested_ids)
            }
            ordered_categories = [categories_by_id[category_id] for category_id in requested_ids if category_id in categories_by_id]
            serializer = CategorySerializer(ordered_categories, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CategorySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CategoryDetail(APIView):
    def get(self, request, category_id):
        category = get_object_or_404(Category, id=category_id)
        serializer = CategorySerializer(category)
        return Response(serializer.data, status=status.HTTP_200_OK)
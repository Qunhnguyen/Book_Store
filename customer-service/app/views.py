import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Customer
from .serializers import CustomerSerializer

CART_SERVICE_URL = "http://cart-service:8000"


class CustomerListCreate(APIView):
    def get(self, request):
        customers = Customer.objects.all().order_by("id")
        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CustomerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        customer = serializer.save()

        try:
            r = requests.post(
                f"{CART_SERVICE_URL}/carts/",
                json={"customer_id": customer.id},
                timeout=3,
            )
            if r.status_code != status.HTTP_201_CREATED:
                customer.delete()
                return Response({"error": "Cannot create cart"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except requests.RequestException:
            customer.delete()
            return Response({"error": "Cannot reach cart-service"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)

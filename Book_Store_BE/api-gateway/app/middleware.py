import os
import jwt
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

# Danh sách các endpoints không yêu cầu JWT
PUBLIC_PATHS = [
    '/api/login/',
    '/api/register/',
    '/api/books/',
    '/api/categories/',
    '/api/reviews/book/',
    '/api/recommendations/',
    '/api/health/',
    '/api/metrics/',
]

class JWTAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request):
        path = request.path_info
        
        # Chỉ check với các api bắt đầu bằng /api/, và không phải public path.
        if not path.startswith('/api/'):
            return None
            
        for public_path in PUBLIC_PATHS:
            if path.startswith(public_path):
                return None
                
        # Các endpoints cần phải secure: carts, orders, payments, shipments, users ...
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Unauthorized: Bearer token is required'}, status=401)
            
        token = auth_header.split(' ')[1]
        jwt_secret = os.environ.get('JWT_SECRET', 'fallback-secret-key')
        
        try:
            payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
            # Gán vào META để forward_request truyền tiếp
            request.META['HTTP_X_USER_ID'] = str(payload.get('customer_id', ''))
            request.META['HTTP_X_USER_EMAIL'] = str(payload.get('email', ''))
        except jwt.ExpiredSignatureError:
            return JsonResponse({'error': 'Unauthorized: Token expired'}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({'error': 'Unauthorized: Invalid token'}, status=401)

        return None

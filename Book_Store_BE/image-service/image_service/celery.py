import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'image_service.settings')

app = Celery('image_service')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

import json
import os
import pika
from django.core.management.base import BaseCommand
from app.models import Payment, ProcessedEvent
from app.events import publish_event
from django.db import transaction

class Command(BaseCommand):
    help = 'Starts the RabbitMQ consumer for pay-service'

    def handle(self, *args, **options):
        rabbitmq_url = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
        exchange_name = "bookstore.topic"
        queue_name = "pay_service_queue"

        import time
        parameters = pika.URLParameters(rabbitmq_url)
        connection = None
        for i in range(10):
            try:
                connection = pika.BlockingConnection(parameters)
                break
            except Exception as e:
                self.stdout.write(f"RabbitMQ not ready yet ({e}). Retrying in 5 seconds...")
                time.sleep(5)
                
        if not connection:
            raise Exception("Failed to connect to RabbitMQ after retries.")
            
        channel = connection.channel()

        channel.exchange_declare(exchange=exchange_name, exchange_type='topic', durable=True)
        channel.queue_declare(queue=queue_name, durable=True)
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="payment.reserve.requested")
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="payment.compensate.requested")

        def callback(ch, method, properties, body):
            event = json.loads(body)
            event_id = event.get('event_id')
            event_type = event.get('event_type')
            saga_id = event.get('saga_id')
            correlation_id = event.get('correlation_id')
            payload = event.get('payload', {})

            self.stdout.write(f"Received {event_type} (event_id: {event_id}, saga_id: {saga_id})")

            # Idempotency check
            if ProcessedEvent.objects.filter(event_id=event_id).exists():
                self.stdout.write(f"Event {event_id} already processed. Skipping.")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            try:
                with transaction.atomic():
                    if event_type == "payment.reserve.requested":
                        order_id = payload.get("order_id")
                        total_price = payload.get("total_price", 0)
                        force_payment_failure = payload.get("force_payment_failure", False)
                        force_shipping_failure = payload.get("force_shipping_failure", False)
                        
                        if force_payment_failure:
                            payment = Payment.objects.create(
                                order_id=order_id,
                                status="FAILED"
                            )
                            publish_event("payment.reserve.completed", {
                                "order_id": order_id,
                                "success": False,
                                "message": "Payment failed (forced for testing)",
                                "force_shipping_failure": force_shipping_failure
                            }, correlation_id=correlation_id, saga_id=saga_id)
                        else:
                            payment = Payment.objects.create(
                                order_id=order_id,
                                status="PAID"
                            )
                            publish_event("payment.reserve.completed", {
                                "order_id": order_id,
                                "success": True,
                                "message": "Payment reserved",
                                "force_shipping_failure": force_shipping_failure
                            }, correlation_id=correlation_id, saga_id=saga_id)
                    
                    elif event_type == "payment.compensate.requested":
                        order_id = payload.get("order_id")
                        payments = Payment.objects.filter(order_id=order_id)
                        for p in payments:
                            p.status = "REFUNDED"
                            p.save()
                            
                        publish_event("payment.compensate.completed", {
                            "order_id": order_id,
                            "success": True,
                            "message": "Payment compensation applied"
                        }, correlation_id=correlation_id, saga_id=saga_id)
                    
                    ProcessedEvent.objects.create(event_id=event_id)
                    
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                self.stdout.write(f"Error processing event {event_id}: {e}")
                # Requeue on failure or fallback
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        channel.basic_consume(queue=queue_name, on_message_callback=callback)

        self.stdout.write(' [*] Waiting for messages.')
        channel.start_consuming()

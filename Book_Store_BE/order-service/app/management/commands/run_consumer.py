import json
import os
import pika
from django.core.management.base import BaseCommand
from app.saga_orchestrator import handle_payment_result, handle_shipping_result, handle_payment_compensate_result

class Command(BaseCommand):
    help = 'Starts the RabbitMQ consumer for order-service Saga'

    def handle(self, *args, **options):
        rabbitmq_url = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
        exchange_name = "bookstore.topic"
        queue_name = "order_service_queue"

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
        # Bind the events that order-service cares about
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="payment.reserve.completed")
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="payment.reserve.failed")
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="shipping.reserve.completed")
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="shipping.reserve.failed")
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key="payment.compensate.completed")
        
        def callback(ch, method, properties, body):
            event = json.loads(body)
            event_type = event.get('event_type')
            saga_id = event.get('saga_id')
            payload = event.get('payload', {})
            success = payload.get('success', True)
            message = payload.get('message', '')

            self.stdout.write(f"Received {event_type} for saga {saga_id}")

            if event_type == "payment.reserve.completed":
                handle_payment_result(saga_id, success, message, payload)
            elif event_type == "payment.reserve.failed":
                handle_payment_result(saga_id, False, message, payload)
            elif event_type == "shipping.reserve.completed":
                handle_shipping_result(saga_id, success, message, payload)
            elif event_type == "shipping.reserve.failed":
                handle_shipping_result(saga_id, False, message, payload)
            elif event_type == "payment.compensate.completed":
                handle_payment_compensate_result(saga_id, success, message, payload)
            
            ch.basic_ack(delivery_tag=method.delivery_tag)

        channel.basic_consume(queue=queue_name, on_message_callback=callback)

        self.stdout.write(' [*] Waiting for messages. To exit press CTRL+C')
        channel.start_consuming()

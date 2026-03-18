import json
import os
import time
import uuid
import pika

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "bookstore.topic"

def publish_event(event_type, payload, correlation_id=None, saga_id=None):
    """
    Publish an event to RabbitMQ using the standardized format.
    """
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
    if not saga_id:
        saga_id = str(uuid.uuid4())

    event_msg = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "event_version": "1.0",
        "saga_id": saga_id,
        "correlation_id": correlation_id,
        "timestamp": int(time.time()),
        "payload": payload
    }

    try:
        parameters = pika.URLParameters(RABBITMQ_URL)
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()

        # Ensure the exchange exists
        channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='topic', durable=True)

        routing_key = event_type
        message_body = json.dumps(event_msg)

        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=routing_key,
            body=message_body,
            properties=pika.BasicProperties(
                delivery_mode=2,  # make message persistent
            )
        )
        print(f" [x] Sent {routing_key}: {message_body}")
        connection.close()
        return True, event_msg
    except Exception as e:
        print(f" [x] Error sending event: {e}")
        return False, None

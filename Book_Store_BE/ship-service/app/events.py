import json
import os
import pika
import time
import uuid

def publish_event(event_type, payload, correlation_id=None, saga_id=None):
    rabbitmq_url = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
    parameters = pika.URLParameters(rabbitmq_url)
    
    try:
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        
        exchange_name = "bookstore.topic"
        channel.exchange_declare(exchange=exchange_name, exchange_type='topic', durable=True)
        
        event_id = str(uuid.uuid4())
        message = {
            "event_id": event_id,
            "event_type": event_type,
            "event_version": "1.0",
            "saga_id": saga_id,
            "correlation_id": correlation_id,
            "timestamp": int(time.time()),
            "payload": payload
        }
        
        channel.basic_publish(
            exchange=exchange_name,
            routing_key=event_type,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
                content_type='application/json',
            )
        )
        print(f" [x] ship-service published {event_type} for saga {saga_id}")
        connection.close()
        return True
    except Exception as e:
        print(f"Failed to publish event {event_type}: {e}")
        return False

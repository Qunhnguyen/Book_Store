import json
import logging
import os
import time
import uuid

import pika

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "bookstore.topic"


def publish_event(event_type, payload, correlation_id=None, saga_id=None):
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
        "payload": payload,
    }

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            parameters = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type="topic", durable=True)
            channel.basic_publish(
                exchange=EXCHANGE_NAME,
                routing_key=event_type,
                body=json.dumps(event_msg),
                properties=pika.BasicProperties(delivery_mode=2),
            )
            logger.info(
                "event_published event_type=%s saga_id=%s correlation_id=%s",
                event_type, saga_id, correlation_id,
            )
            connection.close()
            return True, event_msg
        except Exception as exc:
            logger.warning(
                "event_publish_failed attempt=%d/%d event_type=%s saga_id=%s error=%s",
                attempt, max_attempts, event_type, saga_id, exc,
            )
            if attempt < max_attempts:
                time.sleep(attempt)
    logger.error(
        "event_publish_abandoned event_type=%s saga_id=%s after %d attempts",
        event_type, saga_id, max_attempts,
    )
    return False, None

import json
import logging
import os
import time

import django
import pika

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "bookstore.topic"
QUEUE_NAME = "order_service_queue"
BINDING_KEYS = ["payment.failed", "order.complete.requested", "order.compensate.completed"]


def _process_message(ch, method, properties, body):
    from app.saga_orchestrator import (
        handle_order_compensate_completed,
        handle_payment_failed,
        handle_order_complete,
    )
    try:
        data = json.loads(body)
        event_type = data.get("event_type")
        saga_id = data.get("saga_id", "")
        correlation_id = data.get("correlation_id", "")
        payload = data.get("payload", {})
        message = payload.get("message", "")

        logger.info(
            "consumer_received event_type=%s saga_id=%s correlation_id=%s",
            event_type, saga_id, correlation_id,
        )

        if event_type == "payment.failed":
            handle_payment_failed(saga_id, message, payload)
        elif event_type == "order.complete.requested":
            handle_order_complete(saga_id, message, payload)
        elif event_type == "order.compensate.completed":
            handle_order_compensate_completed(saga_id, True, message, payload)
        else:
            logger.warning("consumer_unknown_event event_type=%s", event_type)

        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as exc:
        logger.exception("consumer_processing_error saga_id=%s error=%s", data.get("saga_id", ""), exc)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


class Command(BaseCommand):
    help = "Consume RabbitMQ events for order-service (Saga orchestrator)"

    def handle(self, *args, **options):
        while True:
            try:
                parameters = pika.URLParameters(RABBITMQ_URL)
                connection = pika.BlockingConnection(parameters)
                channel = connection.channel()

                channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type="topic", durable=True)
                channel.queue_declare(queue=QUEUE_NAME, durable=True)
                for key in BINDING_KEYS:
                    channel.queue_bind(exchange=EXCHANGE_NAME, queue=QUEUE_NAME, routing_key=key)

                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=QUEUE_NAME, on_message_callback=_process_message)

                logger.info("order-consumer started, waiting for events on queue=%s", QUEUE_NAME)
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.warning("order-consumer connection lost: %s — reconnecting in 5s", exc)
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("order-consumer stopped")
                break
            except Exception as exc:
                logger.exception("order-consumer unexpected error: %s — reconnecting in 5s", exc)
                time.sleep(5)


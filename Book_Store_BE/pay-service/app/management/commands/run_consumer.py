import json
import logging
import os
import time

import pika
from django.core.management.base import BaseCommand
from django.db import transaction

from app.models import Payment, ProcessedEvent

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "bookstore.topic"
QUEUE_NAME = "pay_service_queue"
BINDING_KEYS = ["payment.create.requested", "payment.compensate.requested"]


def _process_message(ch, method, properties, body):
    try:
        data = json.loads(body)
        event_type = data.get("event_type")
        event_id = data.get("event_id", "")
        saga_id = data.get("saga_id", "")
        correlation_id = data.get("correlation_id", "")
        payload = data.get("payload", {})
        order_id = payload.get("order_id")

        logger.info(
            "consumer_received event_type=%s saga_id=%s correlation_id=%s event_id=%s",
            event_type, saga_id, correlation_id, event_id,
        )

        # Idempotency check
        if ProcessedEvent.objects.filter(event_id=event_id).exists():
            logger.info("consumer_duplicate_event event_id=%s — skipping", event_id)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        with transaction.atomic():
            if event_type == "payment.create.requested":
                _handle_payment_create(order_id, saga_id, correlation_id)
            elif event_type == "payment.compensate.requested":
                _handle_payment_compensate(order_id, saga_id, correlation_id)
            else:
                logger.warning("consumer_unknown_event event_type=%s", event_type)

            ProcessedEvent.objects.create(event_id=event_id)

        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as exc:
        logger.exception("consumer_processing_error event_id=%s error=%s", data.get("event_id", ""), exc)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def _handle_payment_create(order_id, saga_id, correlation_id):
    """Just create Payment with PENDING status, do not publish further events"""
    payment = Payment.objects.create(order_id=order_id, payment_method="COD", status="PENDING")
    logger.info("payment_created order_id=%s saga_id=%s payment_id=%s status=PENDING", order_id, saga_id, payment.id)


def _handle_payment_compensate(order_id, saga_id, correlation_id):
    from app.events import publish_event
    updated = Payment.objects.filter(order_id=order_id).update(status="REFUNDED")
    logger.info("payment_compensated order_id=%s saga_id=%s updated=%d", order_id, saga_id, updated)
    publish_event(
        "order.compensate.completed",
        {"order_id": order_id, "success": True},
        correlation_id=correlation_id, saga_id=saga_id
    )


class Command(BaseCommand):
    help = "Consume RabbitMQ events for pay-service"

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

                logger.info("pay-consumer started, waiting for events on queue=%s", QUEUE_NAME)
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.warning("pay-consumer connection lost: %s — reconnecting in 5s", exc)
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("pay-consumer stopped")
                break
            except Exception as exc:
                logger.exception("pay-consumer unexpected error: %s — reconnecting in 5s", exc)
                time.sleep(5)

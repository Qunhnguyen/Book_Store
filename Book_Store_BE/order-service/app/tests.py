import json
import requests
from unittest.mock import Mock, patch

from django.test import Client, TestCase

from .models import Order, OrderItem
from .saga_orchestrator import (
    handle_inventory_commit_result,
    handle_inventory_release_result,
    handle_inventory_result,
    handle_payment_compensate_result,
    handle_payment_result,
    handle_shipping_result,
)


class OrderCreateFlowTests(TestCase):
    @patch('app.views.publish_event')
    @patch('app.views.requests.get')
    def test_create_order_starts_inventory_saga(self, mock_get, mock_publish_event):
        cart_response = Mock()
        cart_response.raise_for_status.return_value = None
        cart_response.json.return_value = [{'book_id': 1, 'quantity': 2}]

        books_response = Mock()
        books_response.raise_for_status.return_value = None
        books_response.json.return_value = [{'id': 1, 'price': '10.50'}]

        mock_get.side_effect = [cart_response, books_response]
        mock_publish_event.return_value = (True, {'event_id': 'evt-1'})

        client = Client()
        response = client.post(
            '/orders/',
            data=json.dumps({'customer_id': 7, 'force_payment_failure': False, 'force_shipping_failure': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get()
        self.assertEqual(order.status, 'PENDING')
        self.assertEqual(str(order.total_price), '21.00')
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.reserve.requested')
        self.assertEqual(args[1]['order_id'], order.id)
        self.assertEqual(args[1]['items'], [{'book_id': 1, 'quantity': 2}])
        self.assertTrue(args[1]['force_shipping_failure'])

    @patch('app.views.requests.get')
    def test_create_order_returns_503_when_book_service_unavailable(self, mock_get):
        cart_response = Mock()
        cart_response.raise_for_status.return_value = None
        cart_response.json.return_value = [{'book_id': 1, 'quantity': 1}]
        mock_get.side_effect = [cart_response, requests.RequestException('book service down')]

        client = Client()
        response = client.post(
            '/orders/',
            data=json.dumps({'customer_id': 7}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['error'], 'Cannot reach book-service')
        self.assertFalse(Order.objects.exists())

    @patch('app.views.requests.get')
    def test_create_order_returns_400_when_book_price_missing(self, mock_get):
        cart_response = Mock()
        cart_response.raise_for_status.return_value = None
        cart_response.json.return_value = [{'book_id': 99, 'quantity': 1}]

        books_response = Mock()
        books_response.raise_for_status.return_value = None
        books_response.json.return_value = [{'id': 1, 'price': '10.50'}]

        mock_get.side_effect = [cart_response, books_response]

        client = Client()
        response = client.post(
            '/orders/',
            data=json.dumps({'customer_id': 7}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['missing_book_ids'], [99])
        self.assertFalse(Order.objects.exists())


class OrderSagaOrchestratorTests(TestCase):
    def setUp(self):
        self.order = Order.objects.create(
            customer_id=1,
            status='PENDING',
            total_price='25.00',
            saga_id='saga-1',
            correlation_id='corr-1',
        )
        OrderItem.objects.create(order=self.order, book_id=1, quantity=2)

    @patch('app.saga_orchestrator.publish_event')
    def test_inventory_success_moves_to_payment(self, mock_publish_event):
        mock_publish_event.return_value = (True, {'event_id': 'evt-2'})

        handle_inventory_result('saga-1', True, payload={'force_shipping_failure': True})

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'INVENTORY_RESERVED')
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'payment.reserve.requested')
        self.assertEqual(args[1]['items'], [{'book_id': 1, 'quantity': 2}])
        self.assertTrue(args[1]['force_shipping_failure'])

    @patch('app.saga_orchestrator.publish_event')
    def test_payment_failure_releases_inventory(self, mock_publish_event):
        mock_publish_event.return_value = (True, {'event_id': 'evt-3'})
        self.order.status = 'INVENTORY_RESERVED'
        self.order.save(update_fields=['status'])

        handle_payment_result('saga-1', False, message='declined')

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'COMPENSATING')
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.release.requested')

    @patch('app.saga_orchestrator.publish_event')
    def test_shipping_success_requests_inventory_commit(self, mock_publish_event):
        mock_publish_event.return_value = (True, {'event_id': 'evt-4'})
        self.order.status = 'PAYMENT_RESERVED'
        self.order.save(update_fields=['status'])

        handle_shipping_result('saga-1', True)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'PAYMENT_RESERVED')
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.commit.requested')

    @patch('app.saga_orchestrator.publish_event')
    def test_payment_compensation_releases_inventory(self, mock_publish_event):
        mock_publish_event.return_value = (True, {'event_id': 'evt-5'})
        self.order.status = 'COMPENSATING'
        self.order.save(update_fields=['status'])

        handle_payment_compensate_result('saga-1', True)

        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.release.requested')

    def test_inventory_release_completes_cancellation(self):
        self.order.status = 'COMPENSATING'
        self.order.save(update_fields=['status'])

        handle_inventory_release_result('saga-1', True)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'CANCELLED')

    def test_inventory_commit_confirms_order(self):
        self.order.status = 'PAYMENT_RESERVED'
        self.order.save(update_fields=['status'])

        handle_inventory_commit_result('saga-1', True)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'CONFIRMED')

    def test_inventory_release_failure_marks_order_failed(self):
        self.order.status = 'COMPENSATING'
        self.order.save(update_fields=['status'])

        handle_inventory_release_result('saga-1', False, message='broker timeout')

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'FAILED')


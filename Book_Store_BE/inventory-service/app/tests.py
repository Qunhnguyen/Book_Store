from unittest.mock import patch

from django.test import TestCase

from app.management.commands.run_consumer import (
    _handle_inventory_commit,
    _handle_inventory_release,
    _handle_inventory_reserve,
)
from app.models import InventoryItem, InventoryReservation, ReservationStatus


class InventorySagaHandlerTests(TestCase):
    @patch('app.events.publish_event')
    @patch('app.management.commands.run_consumer._fetch_book_snapshot')
    def test_reserve_bootstraps_inventory_and_publishes_success(self, mock_fetch_book, mock_publish_event):
        mock_fetch_book.return_value = {'id': 1, 'stock': 5}
        mock_publish_event.return_value = (True, {})

        _handle_inventory_reserve(
            order_id=10,
            customer_id=2,
            saga_id='saga-1',
            correlation_id='corr-1',
            items=[{'book_id': 1, 'quantity': 3}],
            payload={},
        )

        item = InventoryItem.objects.get(book_id=1)
        reservation = InventoryReservation.objects.get(saga_id='saga-1', book_id=1)

        self.assertEqual(item.available_qty, 2)
        self.assertEqual(item.reserved_qty, 3)
        self.assertEqual(reservation.status, ReservationStatus.RESERVED)
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.reserve.completed')
        self.assertTrue(args[1]['success'])

    @patch('app.events.publish_event')
    def test_reserve_fails_without_available_stock(self, mock_publish_event):
        mock_publish_event.return_value = (True, {})
        InventoryItem.objects.create(book_id=1, available_qty=1, reserved_qty=0)

        _handle_inventory_reserve(
            order_id=11,
            customer_id=2,
            saga_id='saga-2',
            correlation_id='corr-2',
            items=[{'book_id': 1, 'quantity': 2}],
            payload={},
        )

        item = InventoryItem.objects.get(book_id=1)
        self.assertEqual(item.available_qty, 1)
        self.assertEqual(item.reserved_qty, 0)
        self.assertFalse(InventoryReservation.objects.filter(saga_id='saga-2').exists())
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.reserve.completed')
        self.assertFalse(args[1]['success'])

    @patch('app.events.publish_event')
    def test_commit_moves_reserved_qty_out_of_inventory(self, mock_publish_event):
        mock_publish_event.return_value = (True, {})
        InventoryItem.objects.create(book_id=1, available_qty=2, reserved_qty=3)
        InventoryReservation.objects.create(
            saga_id='saga-3',
            order_id=12,
            book_id=1,
            quantity=3,
            status=ReservationStatus.RESERVED,
        )

        _handle_inventory_commit(order_id=12, customer_id=5, saga_id='saga-3', correlation_id='corr-3')

        item = InventoryItem.objects.get(book_id=1)
        reservation = InventoryReservation.objects.get(saga_id='saga-3', book_id=1)

        self.assertEqual(item.available_qty, 2)
        self.assertEqual(item.reserved_qty, 0)
        self.assertEqual(reservation.status, ReservationStatus.COMMITTED)
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.commit.completed')
        self.assertTrue(args[1]['success'])

    @patch('app.events.publish_event')
    def test_release_restores_available_qty(self, mock_publish_event):
        mock_publish_event.return_value = (True, {})
        InventoryItem.objects.create(book_id=1, available_qty=2, reserved_qty=3)
        InventoryReservation.objects.create(
            saga_id='saga-4',
            order_id=13,
            book_id=1,
            quantity=3,
            status=ReservationStatus.RESERVED,
        )

        _handle_inventory_release(order_id=13, customer_id=6, saga_id='saga-4', correlation_id='corr-4')

        item = InventoryItem.objects.get(book_id=1)
        reservation = InventoryReservation.objects.get(saga_id='saga-4', book_id=1)

        self.assertEqual(item.available_qty, 5)
        self.assertEqual(item.reserved_qty, 0)
        self.assertEqual(reservation.status, ReservationStatus.RELEASED)
        args = mock_publish_event.call_args[0]
        self.assertEqual(args[0], 'inventory.release.completed')
        self.assertTrue(args[1]['success'])

    @patch('app.events.publish_event')
    def test_publish_failure_rolls_back_reservation(self, mock_publish_event):
        mock_publish_event.return_value = (False, None)
        InventoryItem.objects.create(book_id=1, available_qty=5, reserved_qty=0)

        with self.assertRaises(RuntimeError):
            _handle_inventory_reserve(
                order_id=99,
                customer_id=1,
                saga_id='saga-fail',
                correlation_id='corr-fail',
                items=[{'book_id': 1, 'quantity': 2}],
                payload={},
            )

        item = InventoryItem.objects.get(book_id=1)
        self.assertEqual(item.available_qty, 5)
        self.assertEqual(item.reserved_qty, 0)
        self.assertFalse(InventoryReservation.objects.filter(saga_id='saga-fail').exists())


class InventoryApiTests(TestCase):
    def test_inventory_item_list_filters_by_book_ids(self):
        InventoryItem.objects.create(book_id=1, available_qty=5, reserved_qty=0)
        InventoryItem.objects.create(book_id=2, available_qty=3, reserved_qty=1)

        response = self.client.get('/inventory-items/?book_ids=2,1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['book_id'] for item in response.json()], [2, 1])

    def test_inventory_item_put_updates_available_stock_only(self):
        InventoryItem.objects.create(book_id=5, available_qty=2, reserved_qty=3)

        response = self.client.put(
            '/inventory-items/5/',
            data='{"stock":10}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        item = InventoryItem.objects.get(book_id=5)
        self.assertEqual(item.available_qty, 10)
        self.assertEqual(item.reserved_qty, 3)

    def test_inventory_deduct_stock_uses_inventory_source_of_truth(self):
        InventoryItem.objects.create(book_id=7, available_qty=4, reserved_qty=0)

        response = self.client.post(
            '/inventory-items/deduct/',
            data='{"items":[{"book_id":7,"quantity":2}]}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(InventoryItem.objects.get(book_id=7).available_qty, 2)

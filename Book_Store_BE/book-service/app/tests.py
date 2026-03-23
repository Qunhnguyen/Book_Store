from unittest.mock import Mock, patch

from django.test import TestCase

from .models import Book, BookCategoryLink, ImageStatusChoices
from .serializers import BookSerializer


class BookSerializerTest(TestCase):
    def _make_book(self, **kwargs):
        defaults = dict(title='Test Book', author='Test Author', price='9.99', stock=10)
        defaults.update(kwargs)
        return Book.objects.create(**defaults)

    def test_display_image_url_official(self):
        book = self._make_book(official_cover_url='https://example.com/cover.jpg')
        data = BookSerializer(book).data
        self.assertEqual(data['display_image_url'], 'https://example.com/cover.jpg')

    def test_display_image_url_ai_fallback(self):
        book = self._make_book(ai_image_url='https://example.com/ai.jpg')
        data = BookSerializer(book).data
        self.assertEqual(data['display_image_url'], 'https://example.com/ai.jpg')

    def test_display_image_url_placeholder(self):
        book = self._make_book()
        data = BookSerializer(book).data
        self.assertIn('placeholder', data['display_image_url'])

    def test_official_takes_priority_over_ai(self):
        book = self._make_book(
            official_cover_url='https://example.com/official.jpg',
            ai_image_url='https://example.com/ai.jpg',
        )
        data = BookSerializer(book).data
        self.assertEqual(data['display_image_url'], 'https://example.com/official.jpg')


class BookCategoryApiTests(TestCase):
    @patch('app.views._fetch_inventory_stock_map')
    @patch('app.views._enqueue_image_task')
    @patch('app.views._sync_inventory_stock')
    @patch('app.views._fetch_categories_by_ids')
    def test_create_book_with_categories_returns_resolved_categories(self, mock_fetch_categories, mock_sync_inventory_stock, mock_enqueue_image_task, mock_fetch_inventory_stock_map):
        mock_fetch_categories.return_value = {
            1: {'id': 1, 'name': 'Backend'},
            2: {'id': 2, 'name': 'Architecture'},
        }
        mock_sync_inventory_stock.return_value = {'book_id': 1, 'available_qty': 5, 'reserved_qty': 0}
        mock_fetch_inventory_stock_map.return_value = {1: 5}

        response = self.client.post(
            '/books/',
            data='{"title":"My Book","author":"An Author","price":"19.99","stock":5,"category_ids":[1,2]}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['categories'], [
            {'id': 1, 'name': 'Backend'},
            {'id': 2, 'name': 'Architecture'},
        ])
        self.assertEqual(response.json()['stock'], 5)
        self.assertEqual(list(BookCategoryLink.objects.values_list('category_id', flat=True)), [1, 2])
        created_book = Book.objects.get()
        mock_sync_inventory_stock.assert_called_once_with(created_book.id, 5)
        mock_enqueue_image_task.assert_called_once()

    @patch('app.views._fetch_categories_by_ids')
    def test_create_book_with_missing_category_returns_400(self, mock_fetch_categories):
        mock_fetch_categories.return_value = {1: {'id': 1, 'name': 'Backend'}}

        response = self.client.post(
            '/books/',
            data='{"title":"My Book","author":"An Author","price":"19.99","stock":5,"category_ids":[1,99]}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['missing_category_ids'], [99])

    @patch('app.views._fetch_inventory_stock_map')
    @patch('app.views._fetch_categories_by_ids')
    def test_list_books_includes_resolved_categories_and_inventory_stock(self, mock_fetch_categories, mock_fetch_inventory_stock_map):
        mock_fetch_categories.return_value = {3: {'id': 3, 'name': 'Testing'}}
        book = Book.objects.create(title='T', author='A', price='1.00', stock=1)
        BookCategoryLink.objects.create(book=book, category_id=3)
        mock_fetch_inventory_stock_map.return_value = {book.id: 9}

        response = self.client.get('/books/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['categories'], [{'id': 3, 'name': 'Testing'}])
        self.assertEqual(response.json()[0]['stock'], 9)

    @patch('app.views._fetch_inventory_stock_map')
    @patch('app.views._sync_inventory_stock')
    @patch('app.views._fetch_categories_by_ids')
    def test_update_book_replaces_category_links_and_syncs_inventory_when_stock_changes(self, mock_fetch_categories, mock_sync_inventory_stock, mock_fetch_inventory_stock_map):
        book = Book.objects.create(title='T', author='A', price='1.00', stock=1)
        BookCategoryLink.objects.create(book=book, category_id=1)
        mock_fetch_categories.return_value = {4: {'id': 4, 'name': 'Distributed Systems'}}
        mock_sync_inventory_stock.return_value = {'book_id': book.id, 'available_qty': 7, 'reserved_qty': 0}
        mock_fetch_inventory_stock_map.return_value = {book.id: 7}

        response = self.client.put(
            f'/books/{book.id}/',
            data='{"stock":7,"category_ids":[4]}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['categories'], [{'id': 4, 'name': 'Distributed Systems'}])
        self.assertEqual(response.json()['stock'], 7)
        self.assertEqual(list(BookCategoryLink.objects.filter(book=book).values_list('category_id', flat=True)), [4])
        mock_sync_inventory_stock.assert_called_once_with(book.id, 7)

    @patch('app.views.requests.post')
    def test_deduct_stock_forwards_to_inventory_service(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"message":"Stock deducted successfully"}'
        mock_response.json.return_value = {'message': 'Stock deducted successfully'}
        mock_post.return_value = mock_response

        response = self.client.post(
            '/books/deduct-stock/',
            data='{"items":[{"book_id":5,"quantity":1}]}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message'], 'Stock deducted successfully')
        mock_post.assert_called_once()

    def test_rebuild_missing_images(self):
        Book.objects.create(title='T', author='A', price='1.00', stock=1, image_status=ImageStatusChoices.NONE)
        with patch('app.views._enqueue_image_task') as mock_enqueue:
            response = self.client.post('/books/rebuild-missing-images/', content_type='application/json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['count'], 1)
        mock_enqueue.assert_called_once()

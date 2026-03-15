from django.test import TestCase
from unittest.mock import patch, MagicMock
from .models import Book, ImageStatusChoices, ImageSourceChoices
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


class BookViewTest(TestCase):
    def test_create_book_returns_201(self):
        from django.test import Client
        c = Client()
        with patch('app.views._enqueue_image_task'):
            resp = c.post(
                '/books/',
                data='{"title":"My Book","author":"An Author","price":"19.99","stock":5}',
                content_type='application/json',
            )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['title'], 'My Book')

    def test_rebuild_missing_images(self):
        from django.test import Client
        Book.objects.create(title='T', author='A', price='1.00', stock=1, image_status=ImageStatusChoices.NONE)
        c = Client()
        with patch('app.views._enqueue_image_task') as mock_enqueue:
            resp = c.post('/books/rebuild-missing-images/', content_type='application/json')
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.json()['count'], 1)
        mock_enqueue.assert_called_once()

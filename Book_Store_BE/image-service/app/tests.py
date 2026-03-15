from django.test import TestCase
from unittest.mock import patch, MagicMock


class OpenLibraryServiceTest(TestCase):
    def test_get_cover_url_by_isbn_success(self):
        from app.services.open_library import OpenLibraryService
        mock_data = {
            'ISBN:1234567890': {'cover': {'large': 'https://example.com/cover.jpg'}}
        }
        with patch('app.services.open_library.requests.get') as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.raise_for_status = lambda: None
            mock_get.return_value.json.return_value = mock_data
            svc = OpenLibraryService()
            result = svc.get_cover_url(isbn='1234567890')
        self.assertEqual(result, 'https://example.com/cover.jpg')

    def test_get_cover_url_fallback_to_title_search(self):
        from app.services.open_library import OpenLibraryService
        with patch('app.services.open_library.requests.get') as mock_get:
            # ISBN lookup returns empty
            empty_resp = MagicMock()
            empty_resp.raise_for_status = lambda: None
            empty_resp.json.return_value = {}
            # Title search returns docs with cover_i
            search_resp = MagicMock()
            search_resp.raise_for_status = lambda: None
            search_resp.json.return_value = {'docs': [{'cover_i': 12345}]}
            mock_get.side_effect = [empty_resp, search_resp]
            svc = OpenLibraryService()
            result = svc.get_cover_url(isbn='0000', title='Test Book', author='Test Author')
        self.assertIn('12345', result)

    def test_returns_none_on_network_error(self):
        from app.services.open_library import OpenLibraryService
        import requests as req_mod
        with patch('app.services.open_library.requests.get', side_effect=req_mod.RequestException('timeout')):
            svc = OpenLibraryService()
            result = svc.get_cover_url(isbn='999', title='X', author='Y')
        self.assertIsNone(result)


class AIGeneratorServiceTest(TestCase):
    def test_returns_none_if_no_api_key(self):
        from app.services.ai_generator import AIGeneratorService
        with self.settings(OPENAI_API_KEY=''):
            svc = AIGeneratorService()
            result = svc.generate(title='Test', author='Author')
        self.assertIsNone(result)

    def test_prompt_has_no_text_instruction(self):
        from app.services.ai_generator import AIGeneratorService
        svc = AIGeneratorService()
        prompt = svc.build_prompt('Clean Code', 'Robert C. Martin')
        self.assertIn('Clean Code', prompt)
        self.assertIn('No text', prompt)


class ProcessBookImageTaskTest(TestCase):
    @patch('app.tasks._patch_book')
    @patch('app.tasks.OpenLibraryService')
    def test_official_cover_found_sets_status_ready(self, MockOL, mock_patch):
        MockOL.return_value.get_cover_url.return_value = 'https://example.com/cover.jpg'
        from app.tasks import process_book_image_task
        process_book_image_task(book_id=1, title='Test', author='Author', isbn='123')
        # Should patch with OFFICIAL and READY
        patch_calls = [call.args[1] for call in mock_patch.call_args_list]
        final_patch = patch_calls[-1]
        self.assertEqual(final_patch.get('image_status'), 'READY')
        self.assertEqual(final_patch.get('image_source'), 'OFFICIAL')

    @patch('app.tasks._patch_book')
    @patch('app.tasks.StorageAdapter')
    @patch('app.tasks.AIGeneratorService')
    @patch('app.tasks.OpenLibraryService')
    def test_fallback_to_ai_when_no_official(self, MockOL, MockAI, MockStorage, mock_patch):
        MockOL.return_value.get_cover_url.return_value = None
        MockAI.return_value.generate.return_value = b'imagedata'
        MockStorage.return_value.upload.return_value = 'https://cdn.example.com/ai.jpg'
        from app.tasks import process_book_image_task
        process_book_image_task(book_id=2, title='Test', author='Author')
        patch_calls = [call.args[1] for call in mock_patch.call_args_list]
        final_patch = patch_calls[-1]
        self.assertEqual(final_patch.get('image_status'), 'READY')
        self.assertEqual(final_patch.get('image_source'), 'AI')

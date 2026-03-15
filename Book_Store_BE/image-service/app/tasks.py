import hashlib
import logging
from datetime import datetime, timezone

import requests as http_requests
from celery import shared_task

from .services.open_library import OpenLibraryService
from .services.ai_generator import AIGeneratorService
from .services.storage import StorageAdapter

logger = logging.getLogger(__name__)

BOOK_SERVICE_URL = 'http://book-service:8000'
MAX_RETRIES = 3


def _patch_book(book_id: int, payload: dict) -> bool:
    """PATCH image fields back to book-service."""
    try:
        r = http_requests.patch(
            f'{BOOK_SERVICE_URL}/books/{book_id}/',
            json=payload,
            timeout=5,
        )
        r.raise_for_status()
        return True
    except Exception as exc:
        logger.error('Failed to PATCH book %d: %s', book_id, exc)
        return False


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=30, name='app.tasks.process_book_image_task')
def process_book_image_task(self, book_id: int, title: str, author: str, isbn: str = ''):
    """Main pipeline: try official cover, fall back to AI, fall back to placeholder."""
    logger.info('[Task] Processing image for book %d — %s', book_id, title)

    # Signal we're working
    _patch_book(book_id, {'image_status': 'GENERATING'})

    try:
        # 1 — Try official cover from Open Library
        ol = OpenLibraryService()
        cover_url = ol.get_cover_url(isbn=isbn, title=title, author=author)

        if cover_url:
            logger.info('[Task] Official cover found for book %d: %s', book_id, cover_url)
            _patch_book(book_id, {
                'official_cover_url': cover_url,
                'official_cover_source': 'openlibrary',
                'image_source': 'OFFICIAL',
                'image_status': 'READY',
                'image_last_checked_at': datetime.now(timezone.utc).isoformat(),
            })
            return

        # 2 — No official cover: generate AI illustration
        logger.info('[Task] No official cover for book %d, generating AI image...', book_id)
        prompt = f'Book cover illustration for "{title}" by {author}. Artistic style, no text on image.'
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()

        ai = AIGeneratorService()
        image_bytes = ai.generate(title=title, author=author)

        if image_bytes:
            storage = StorageAdapter()
            public_id = f'book_covers/{book_id}_{prompt_hash[:8]}'
            ai_url = storage.upload(image_bytes, public_id)

            if ai_url:
                logger.info('[Task] AI image uploaded for book %d: %s', book_id, ai_url)
                _patch_book(book_id, {
                    'ai_image_url': ai_url,
                    'image_source': 'AI',
                    'image_status': 'READY',
                    'image_prompt': prompt,
                    'image_prompt_hash': prompt_hash,
                    'image_generated_at': datetime.now(timezone.utc).isoformat(),
                    'image_last_checked_at': datetime.now(timezone.utc).isoformat(),
                })
                return

        # 3 — Fallback to placeholder
        logger.info('[Task] Using placeholder for book %d', book_id)
        _patch_book(book_id, {
            'image_source': 'PLACEHOLDER',
            'image_status': 'READY',
            'image_last_checked_at': datetime.now(timezone.utc).isoformat(),
        })

    except Exception as exc:
        logger.exception('[Task] Error processing book %d: %s', book_id, exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _patch_book(book_id, {'image_status': 'FAILED'})


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=30, name='app.tasks.generate_ai_image_task')
def generate_ai_image_task(self, book_id: int, title: str, author: str):
    """Force AI generation — ignores Open Library entirely."""
    logger.info('[Task] Force AI generation for book %d', book_id)
    _patch_book(book_id, {'image_status': 'GENERATING'})

    try:
        prompt = f'Book cover illustration for "{title}" by {author}. Artistic style, no text on image.'
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()

        ai = AIGeneratorService()
        image_bytes = ai.generate(title=title, author=author)

        if image_bytes:
            storage = StorageAdapter()
            ai_url = storage.upload(image_bytes, f'book_covers/{book_id}_{prompt_hash[:8]}')
            if ai_url:
                _patch_book(book_id, {
                    'ai_image_url': ai_url,
                    'image_source': 'AI',
                    'image_status': 'READY',
                    'image_prompt': prompt,
                    'image_prompt_hash': prompt_hash,
                    'image_generated_at': datetime.now(timezone.utc).isoformat(),
                })
                return

        _patch_book(book_id, {'image_source': 'PLACEHOLDER', 'image_status': 'READY'})

    except Exception as exc:
        logger.exception('[Task] Force AI error for book %d: %s', book_id, exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            _patch_book(book_id, {'image_status': 'FAILED'})

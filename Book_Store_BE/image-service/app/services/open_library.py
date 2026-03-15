import hashlib
import logging
import requests

logger = logging.getLogger(__name__)

OPEN_LIBRARY_COVER_URL = 'https://covers.openlibrary.org/b/{key}/{isbn}-L.jpg'
OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json'
OPEN_LIBRARY_ISBN_URL = 'https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data'
TIMEOUT = 6


def _hash_str(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


class OpenLibraryService:
    """Fetches official book cover URLs from Open Library."""

    def get_cover_url(self, isbn: str = '', title: str = '', author: str = '') -> str | None:
        """Return a working cover URL or None."""
        cover_url = None
        if isbn:
            cover_url = self._fetch_by_isbn(isbn)
        if not cover_url and (title or author):
            cover_url = self._fetch_by_title_author(title, author)
        return cover_url

    def _fetch_by_isbn(self, isbn: str) -> str | None:
        url = OPEN_LIBRARY_ISBN_URL.format(isbn=isbn)
        try:
            resp = requests.get(url, timeout=TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            key = f'ISBN:{isbn}'
            if key in data:
                cover = data[key].get('cover', {})
                large = cover.get('large') or cover.get('medium') or cover.get('small')
                if large:
                    return large
        except (requests.RequestException, ValueError) as exc:
            logger.warning('OpenLibrary ISBN lookup failed: %s', exc)
        return None

    def _fetch_by_title_author(self, title: str, author: str) -> str | None:
        query = f'{title} {author}'.strip()
        try:
            resp = requests.get(OPEN_LIBRARY_SEARCH_URL, params={'q': query, 'limit': 5}, timeout=TIMEOUT)
            resp.raise_for_status()
            docs = resp.json().get('docs', [])
        except (requests.RequestException, ValueError) as exc:
            logger.warning('OpenLibrary search failed: %s', exc)
            return None

        for doc in docs:
            cover_i = doc.get('cover_i')
            if cover_i:
                return f'https://covers.openlibrary.org/b/id/{cover_i}-L.jpg'
        return None

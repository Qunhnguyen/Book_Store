import logging
import io
import urllib.request
from django.conf import settings

logger = logging.getLogger(__name__)


class AIGeneratorService:
    """Generates an AI illustration for a book using available provider.

    If OPENAI_API_KEY is set it calls DALL-E 3.
    Otherwise returns None so caller falls back to placeholder gracefully.
    """

    def generate(self, title: str, author: str) -> bytes | None:
        """Return raw PNG/JPEG bytes, or None on failure."""
        api_key = getattr(settings, 'OPENAI_API_KEY', '')
        if not api_key:
            logger.warning('OPENAI_API_KEY not set — skipping AI generation.')
            return None
        try:
            return self._call_dalle(api_key, title, author)
        except Exception as exc:
            logger.error('AI generation failed: %s', exc)
            return None

    def build_prompt(self, title: str, author: str) -> str:
        return (
            f"Book cover illustration for \"{title}\" by {author}. "
            "Artistic, professional book cover art. No text, no letters, no words on the image."
        )

    def _call_dalle(self, api_key: str, title: str, author: str) -> bytes | None:
        import urllib.request, urllib.error, json as json_mod
        prompt = self.build_prompt(title, author)
        payload = {
            'model': 'dall-e-3',
            'prompt': prompt,
            'n': 1,
            'size': '512x512',
            'response_format': 'url',
        }
        data = json_mod.dumps(payload).encode()
        req = urllib.request.Request(
            'https://api.openai.com/v1/images/generations',
            data=data,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json_mod.loads(resp.read())
            url = result['data'][0]['url']
            with urllib.request.urlopen(url, timeout=15) as img_resp:
                return img_resp.read()
        except Exception as exc:
            logger.error('DALL-E call error: %s', exc)
            return None

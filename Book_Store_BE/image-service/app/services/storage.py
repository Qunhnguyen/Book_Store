import logging
import io
import urllib.parse
from django.conf import settings

logger = logging.getLogger(__name__)


class StorageAdapter:
    """Uploads image bytes to Cloudinary and returns the public URL.

    If CLOUDINARY_URL is not configured, saves the image as a local file
    under /tmp/ and returns a placeholder URL — useful for local dev/testing.
    """

    def upload(self, image_bytes: bytes, public_id: str) -> str | None:
        cloudinary_url = getattr(settings, 'CLOUDINARY_URL', '')
        if cloudinary_url:
            return self._upload_to_cloudinary(image_bytes, public_id, cloudinary_url)
        return self._save_locally(image_bytes, public_id)

    def _upload_to_cloudinary(self, image_bytes: bytes, public_id: str, cloudinary_url: str) -> str | None:
        try:
            import cloudinary
            import cloudinary.uploader
            cloudinary.config(cloudinary_url=cloudinary_url)
            result = cloudinary.uploader.upload(
                io.BytesIO(image_bytes),
                public_id=public_id,
                overwrite=True,
                resource_type='image',
            )
            return result.get('secure_url')
        except ImportError:
            logger.warning('cloudinary package not installed, falling back to local save.')
            return self._save_locally(image_bytes, public_id)
        except Exception as exc:
            logger.error('Cloudinary upload failed: %s', exc)
            return None

    def _save_locally(self, image_bytes: bytes, public_id: str) -> str | None:
        """Dev fallback: saves to /tmp/ and returns a marker URL."""
        safe_id = public_id.replace('/', '_')
        filepath = f'/tmp/{safe_id}.jpg'
        try:
            with open(filepath, 'wb') as f:
                f.write(image_bytes)
            logger.info('Image saved locally: %s', filepath)
            return f'/local-images/{safe_id}.jpg'
        except Exception as exc:
            logger.error('Local save failed: %s', exc)
            return None

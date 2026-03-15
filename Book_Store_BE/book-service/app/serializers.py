from rest_framework import serializers
from .models import Book


PLACEHOLDER_URL = '/static/placeholder-cover.png'


class BookSerializer(serializers.ModelSerializer):
    display_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'author', 'price', 'stock', 'isbn',
            'official_cover_url', 'ai_image_url',
            'image_source', 'image_status',
            'image_prompt', 'image_generated_at', 'image_last_checked_at',
            'display_image_url',
        ]
        read_only_fields = [
            'official_cover_url', 'ai_image_url', 'image_source',
            'image_status', 'image_prompt', 'image_prompt_hash',
            'image_generated_at', 'image_last_checked_at', 'display_image_url',
        ]

    def get_display_image_url(self, obj):
        if obj.official_cover_url:
            return obj.official_cover_url
        if obj.ai_image_url:
            return obj.ai_image_url
        return PLACEHOLDER_URL


class BookImagePatchSerializer(serializers.ModelSerializer):
    """Used exclusively by image-service to update image fields on a book."""
    class Meta:
        model = Book
        fields = [
            'official_cover_url', 'official_cover_source', 'official_cover_key',
            'ai_image_url', 'image_source', 'image_status',
            'image_prompt', 'image_prompt_hash',
            'image_generated_at', 'image_last_checked_at',
        ]
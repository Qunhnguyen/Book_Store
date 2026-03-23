from django.db import models


class ImageSourceChoices(models.TextChoices):
    OFFICIAL = 'OFFICIAL', 'Official Cover'
    AI = 'AI', 'AI Generated'
    PLACEHOLDER = 'PLACEHOLDER', 'Placeholder'


class ImageStatusChoices(models.TextChoices):
    NONE = 'NONE', 'None'
    PENDING = 'PENDING', 'Pending'
    GENERATING = 'GENERATING', 'Generating'
    READY = 'READY', 'Ready'
    FAILED = 'FAILED', 'Failed'


class Book(models.Model):
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField()

    isbn = models.CharField(max_length=20, null=True, blank=True)
    official_cover_url = models.URLField(max_length=1024, null=True, blank=True)
    official_cover_source = models.CharField(max_length=50, null=True, blank=True)
    official_cover_key = models.CharField(max_length=255, null=True, blank=True)

    ai_image_url = models.URLField(max_length=1024, null=True, blank=True)
    image_source = models.CharField(
        max_length=20,
        choices=ImageSourceChoices.choices,
        default=ImageSourceChoices.PLACEHOLDER,
    )
    image_status = models.CharField(
        max_length=20,
        choices=ImageStatusChoices.choices,
        default=ImageStatusChoices.NONE,
    )
    image_prompt = models.TextField(null=True, blank=True)
    image_prompt_hash = models.CharField(max_length=64, null=True, blank=True)
    image_generated_at = models.DateTimeField(null=True, blank=True)
    image_last_checked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} by {self.author}"


class BookCategoryLink(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='category_links')
    category_id = models.IntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['book', 'category_id'], name='unique_book_category_link')
        ]
        ordering = ['id']

    def __str__(self):
        return f"Book {self.book_id} -> Category {self.category_id}"
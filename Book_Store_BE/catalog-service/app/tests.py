from django.test import TestCase

from .models import Category


class CategoryApiTests(TestCase):
    def test_list_categories_can_filter_by_ids(self):
        first = Category.objects.create(name="Backend")
        second = Category.objects.create(name="Architecture")
        Category.objects.create(name="Testing")

        response = self.client.get(f"/categories/?ids={second.id},{first.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [
            {"id": second.id, "name": "Architecture"},
            {"id": first.id, "name": "Backend"},
        ])

    def test_category_detail_returns_single_category(self):
        category = Category.objects.create(name="Distributed Systems")

        response = self.client.get(f"/categories/{category.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": category.id, "name": "Distributed Systems"})
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthEndpointTests(APITestCase):
    """GET /api/health/ -- load-balancer probe, not a DRF view."""

    def setUp(self):
        self.url = reverse("health")

    def test_reports_ok_when_the_database_is_up(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"ok": True})

    def test_does_not_require_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_rejects_writes(self):
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_leaks_no_debug_or_version_fields(self):
        payload = self.client.get(self.url).json()

        self.assertEqual(set(payload), {"ok"})

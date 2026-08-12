from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import UserFactory
from contact.models import ContactMessage


class ContactAPITests(APITestCase):
    """POST /api/contact/"""

    def setUp(self):
        self.url = reverse("contact:create")
        self.payload = {
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "subject": "Ignis availability",
            "message": "When does the Ignis reach the UK?",
        }
        # DRF throttling counts requests in the cache, which persists between
        # tests in the same process. Without clearing it, the sixth test in this
        # class would fail with a 429 for reasons that have nothing to do with
        # what it is asserting.
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_anyone_can_send_a_message(self):
        response = self.client.post(self.url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_a_logged_in_sender_is_attributed_to_their_account(self):
        user = UserFactory()
        self.client.force_authenticate(user=user)

        self.client.post(self.url, self.payload)

        self.assertEqual(ContactMessage.objects.get().user, user)

    def test_an_anonymous_message_has_no_user(self):
        self.client.post(self.url, self.payload)

        self.assertIsNone(ContactMessage.objects.get().user)

    def test_a_too_short_message_is_rejected(self):
        response = self.client.post(self.url, {**self.payload, "message": "hi"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_an_invalid_email_is_rejected(self):
        response = self.client.post(self.url, {**self.payload, "email": "not-an-email"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_endpoint_is_write_only(self):
        """
        Enquiries are private. A GET that listed them would leak every visitor's
        name, email and message to the open internet.
        """
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_flooding_the_form_is_throttled(self):
        """The rate limit is 5/hour per IP; the sixth request must be refused."""
        for _ in range(5):
            self.client.post(self.url, self.payload)

        response = self.client.post(self.url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(ContactMessage.objects.count(), 5)

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import TEST_PASSWORD, UserFactory

User = get_user_model()


class RegistrationAPITests(APITestCase):
    """POST /api/auth/register/"""

    def setUp(self):
        # reverse() rather than a hardcoded "/api/auth/register/": if the URL
        # ever moves, these tests follow it instead of failing for the wrong
        # reason.
        self.url = reverse("accounts:register")
        self.payload = {
            "username": "newdriver",
            "email": "new@fonix.test",
            "password": TEST_PASSWORD,
            "password_confirm": TEST_PASSWORD,
        }

    def test_anyone_can_register(self):
        response = self.client.post(self.url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newdriver")
        self.assertTrue(user.check_password(TEST_PASSWORD))

    def test_password_is_never_echoed_back(self):
        response = self.client.post(self.url, self.payload)

        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)

    def test_registration_always_creates_a_customer(self):
        """
        Privilege escalation guard: posting role="admin" must not grant it.
        The field is read-only on the serializer, so DRF ignores it silently --
        which is exactly why it needs a test to prove it stays that way.
        """
        response = self.client.post(self.url, {**self.payload, "role": "admin"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            User.objects.get(username="newdriver").role, User.Role.CUSTOMER
        )

    def test_mismatched_passwords_are_rejected(self):
        response = self.client.post(
            self.url, {**self.payload, "password_confirm": "something-else"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)
        self.assertFalse(User.objects.filter(username="newdriver").exists())

    def test_weak_passwords_are_rejected_by_djangos_validators(self):
        response = self.client.post(
            self.url, {**self.payload, "password": "123", "password_confirm": "123"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_duplicate_username_is_rejected(self):
        UserFactory(username="newdriver")

        response = self.client.post(self.url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_duplicate_email_is_rejected(self):
        UserFactory(email="new@fonix.test")

        response = self.client.post(self.url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)


class LoginAPITests(APITestCase):
    """POST /api/auth/login/ and /api/auth/refresh/"""

    def setUp(self):
        self.url = reverse("accounts:login")
        self.user = UserFactory(username="driver")

    def test_valid_credentials_return_a_token_pair_and_the_user(self):
        response = self.client.post(
            self.url, {"username": "driver", "password": TEST_PASSWORD}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        # The bundled user object is what lets the frontend render the navbar
        # without a second request -- see FoNixTokenObtainPairSerializer.
        self.assertEqual(response.data["user"]["username"], "driver")
        self.assertEqual(response.data["user"]["role"], User.Role.CUSTOMER)

    def test_wrong_password_is_rejected(self):
        response = self.client.post(
            self.url, {"username": "driver", "password": "wrong-password"}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)

    def test_unknown_user_is_rejected(self):
        response = self.client.post(
            self.url, {"username": "ghost", "password": TEST_PASSWORD}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_refresh_token_buys_a_new_access_token(self):
        login = self.client.post(
            self.url, {"username": "driver", "password": TEST_PASSWORD}
        )

        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": login.data["refresh"]}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_a_garbage_refresh_token_is_rejected(self):
        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": "not-a-real-token"}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MeAPITests(APITestCase):
    """GET/PATCH /api/auth/me/"""

    def setUp(self):
        self.url = reverse("accounts:me")
        self.user = UserFactory(username="driver")

    def test_anonymous_users_are_rejected(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_an_authenticated_user_gets_their_own_profile(self):
        # force_authenticate bypasses the token exchange -- we are testing the
        # view here, and login already has its own tests above.
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "driver")

    def test_a_user_cannot_promote_themselves_to_admin(self):
        """The other half of the escalation guard: not at registration, and not
        by editing the profile afterwards either."""
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(self.url, {"role": "admin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, User.Role.CUSTOMER)

    def test_a_user_can_update_their_own_name(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(self.url, {"first_name": "Ada"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Ada")

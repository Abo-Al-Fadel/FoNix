from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import TEST_PASSWORD, UserFactory

User = get_user_model()


class RegistrationAPITests(APITestCase):
    """POST /api/auth/register/"""

    def setUp(self):
        self.url = reverse("accounts:register")
        self.payload = {
            "username": "newdriver",
            "email": "new@fonix.test",
            "password": TEST_PASSWORD,
            "password_confirm": TEST_PASSWORD,
        }
        cache.clear()

    def tearDown(self):
        cache.clear()

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
        cache.clear()

    def tearDown(self):
        cache.clear()

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
        self.assertIn("refresh", response.data)

    def test_a_used_refresh_token_is_rejected(self):
        """Rotation blacklists the previous refresh token so a stolen one dies
        the moment the legitimate client refreshes."""
        login = self.client.post(
            self.url, {"username": "driver", "password": TEST_PASSWORD}
        )
        used = login.data["refresh"]

        first = self.client.post(reverse("accounts:refresh"), {"refresh": used})
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        reused = self.client.post(reverse("accounts:refresh"), {"refresh": used})
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_garbage_refresh_token_is_rejected(self):
        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": "not-a-real-token"}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_flooding_login_is_throttled(self):
        """Ten failures per minute are allowed; the eleventh must be 429."""
        payload = {"username": "driver", "password": "wrong-password"}
        for _ in range(10):
            response = self.client.post(self.url, payload)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(self.url, payload)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


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


class PasswordResetAPITests(APITestCase):
    """POST /api/auth/password-reset/ and /confirm/"""

    def setUp(self):
        self.request_url = reverse("accounts:password-reset")
        self.confirm_url = reverse("accounts:password-reset-confirm")
        self.user = UserFactory(email="driver@fonix.test")
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _params_from_mailbox(self):
        from urllib.parse import parse_qs, urlparse

        from django.core import mail

        body = mail.outbox[-1].body
        link = next(part for part in body.split() if "reset-password" in part)
        query = parse_qs(urlparse(link).query)
        return query["uid"][0], query["token"][0]

    def test_unknown_and_known_emails_return_the_same_body(self):
        known = self.client.post(self.request_url, {"email": "driver@fonix.test"})
        unknown = self.client.post(self.request_url, {"email": "ghost@fonix.test"})

        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data, unknown.data)

    def test_a_known_address_receives_a_reset_email(self):
        from django.core import mail

        self.client.post(self.request_url, {"email": "driver@fonix.test"})

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset-password", mail.outbox[0].body)

    def test_an_unknown_address_does_not_send_mail(self):
        from django.core import mail

        self.client.post(self.request_url, {"email": "ghost@fonix.test"})

        self.assertEqual(len(mail.outbox), 0)

    def test_email_lookup_is_case_insensitive(self):
        from django.core import mail

        self.client.post(self.request_url, {"email": "Driver@FONIX.test"})

        self.assertEqual(len(mail.outbox), 1)

    def test_inactive_accounts_are_treated_as_unknown(self):
        from django.core import mail

        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.client.post(self.request_url, {"email": "driver@fonix.test"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_a_mail_failure_still_returns_200(self):
        from unittest.mock import patch

        with patch("accounts.views.send_mail", side_effect=OSError("smtp down")):
            response = self.client.post(
                self.request_url, {"email": "driver@fonix.test"}
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_valid_token_sets_the_new_password(self):
        self.client.post(self.request_url, {"email": "driver@fonix.test"})
        uid, token = self._params_from_mailbox()
        new_password = "ember-wheel-2049"

        response = self.client.post(
            self.confirm_url,
            {
                "uid": uid,
                "token": token,
                "password": new_password,
                "password_confirm": new_password,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        self.assertFalse(self.user.check_password(TEST_PASSWORD))

        login = self.client.post(
            reverse("accounts:login"),
            {"username": self.user.username, "password": new_password},
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_a_spent_token_cannot_be_reused(self):
        self.client.post(self.request_url, {"email": "driver@fonix.test"})
        uid, token = self._params_from_mailbox()
        payload = {
            "uid": uid,
            "token": token,
            "password": "ember-wheel-2049",
            "password_confirm": "ember-wheel-2049",
        }
        self.client.post(self.confirm_url, payload)

        response = self.client.post(self.confirm_url, payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_invalid_token_is_rejected(self):
        response = self.client.post(
            self.confirm_url,
            {
                "uid": "abc",
                "token": "not-a-token",
                "password": "ember-wheel-2049",
                "password_confirm": "ember-wheel-2049",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_revokes_existing_refresh_tokens(self):
        login = self.client.post(
            reverse("accounts:login"),
            {"username": self.user.username, "password": TEST_PASSWORD},
        )
        refresh = login.data["refresh"]

        self.client.post(self.request_url, {"email": "driver@fonix.test"})
        uid, token = self._params_from_mailbox()
        self.client.post(
            self.confirm_url,
            {
                "uid": uid,
                "token": token,
                "password": "ember-wheel-2049",
                "password_confirm": "ember-wheel-2049",
            },
        )

        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": refresh}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

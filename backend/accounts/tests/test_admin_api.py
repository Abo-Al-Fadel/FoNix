from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import (
    TEST_PASSWORD,
    AdminUserFactory,
    OwnerUserFactory,
    StaffUserFactory,
    UserFactory,
)

User = get_user_model()


class UserAdminAccessTests(APITestCase):
    """Who may reach /api/admin/users/ at all."""

    def setUp(self):
        self.url = reverse("admin_api:admin-user-list")

    def test_anonymous_is_unauthorised(self):
        self.assertEqual(
            self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_customer_is_forbidden(self):
        self.client.force_authenticate(UserFactory())
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_is_forbidden(self):
        # Staff manage cars, not people -- the users endpoint is admin and above.
        self.client.force_authenticate(StaffUserFactory())
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_may_list_users(self):
        self.client.force_authenticate(AdminUserFactory())
        UserFactory()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_reports_order_aggregates(self):
        self.client.force_authenticate(AdminUserFactory())
        UserFactory()
        row = self.client.get(self.url).data["results"][0]
        # The two annotated fields the dashboard renders are present.
        self.assertIn("order_count", row)
        self.assertIn("total_spent", row)


class RoleChangeGuardrailTests(APITestCase):
    """The who-may-set-which-role rules."""

    def _detail_url(self, user):
        return reverse("admin_api:admin-user-detail", args=[user.pk])

    def test_admin_can_promote_a_customer_to_staff(self):
        admin = AdminUserFactory()
        customer = UserFactory()
        self.client.force_authenticate(admin)

        response = self.client.patch(
            self._detail_url(customer), {"role": User.Role.STAFF}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.role, User.Role.STAFF)

    def test_admin_cannot_grant_the_owner_role(self):
        admin = AdminUserFactory()
        customer = UserFactory()
        self.client.force_authenticate(admin)

        response = self.client.patch(
            self._detail_url(customer), {"role": User.Role.OWNER}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        customer.refresh_from_db()
        self.assertEqual(customer.role, User.Role.CUSTOMER)

    def test_only_an_owner_can_grant_the_owner_role(self):
        OwnerUserFactory()  # a second owner so last-owner protection is not in play
        owner = OwnerUserFactory()
        customer = UserFactory()
        self.client.force_authenticate(owner)

        response = self.client.patch(
            self._detail_url(customer), {"role": User.Role.OWNER}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.role, User.Role.OWNER)

    def test_admin_cannot_touch_an_owner_account(self):
        admin = AdminUserFactory()
        owner = OwnerUserFactory()
        self.client.force_authenticate(admin)

        response = self.client.patch(
            self._detail_url(owner), {"role": User.Role.ADMIN}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        owner.refresh_from_db()
        self.assertEqual(owner.role, User.Role.OWNER)

    def test_nobody_can_change_their_own_role(self):
        admin = AdminUserFactory()
        self.client.force_authenticate(admin)

        response = self.client.patch(
            self._detail_url(admin), {"role": User.Role.CUSTOMER}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        admin.refresh_from_db()
        self.assertEqual(admin.role, User.Role.ADMIN)


class DeactivationGuardrailTests(APITestCase):
    def _detail_url(self, user):
        return reverse("admin_api:admin-user-detail", args=[user.pk])

    def test_admin_can_deactivate_a_customer(self):
        admin = AdminUserFactory()
        customer = UserFactory()
        self.client.force_authenticate(admin)

        response = self.client.patch(self._detail_url(customer), {"is_active": False})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertFalse(customer.is_active)

    def test_nobody_can_deactivate_themselves(self):
        admin = AdminUserFactory()
        self.client.force_authenticate(admin)

        response = self.client.patch(self._detail_url(admin), {"is_active": False})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        admin.refresh_from_db()
        self.assertTrue(admin.is_active)

    def test_the_last_owner_cannot_be_demoted(self):
        # A superuser (owner by rank, but role="customer") acts on the sole
        # role=owner account. Demoting it would leave the business with no owner,
        # so it is refused even for the top of the hierarchy.
        root = User.objects.create_superuser(
            username="root", email="root@fonix.test", password=TEST_PASSWORD
        )
        sole_owner = OwnerUserFactory()
        self.client.force_authenticate(root)

        response = self.client.patch(
            self._detail_url(sole_owner), {"role": User.Role.ADMIN}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        sole_owner.refresh_from_db()
        self.assertEqual(sole_owner.role, User.Role.OWNER)

    def test_an_owner_can_be_demoted_when_another_owner_remains(self):
        root = User.objects.create_superuser(
            username="root", email="root@fonix.test", password=TEST_PASSWORD
        )
        OwnerUserFactory()  # a second, surviving owner
        demotable = OwnerUserFactory()
        self.client.force_authenticate(root)

        response = self.client.patch(
            self._detail_url(demotable), {"role": User.Role.ADMIN}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        demotable.refresh_from_db()
        self.assertEqual(demotable.role, User.Role.ADMIN)


class HangarStatsTests(APITestCase):
    def setUp(self):
        self.url = reverse("admin_api:admin-stats")

    def test_staff_cannot_read_hangar_stats(self):
        self.client.force_authenticate(StaffUserFactory())
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_sees_operational_counts_not_margin(self):
        self.client.force_authenticate(AdminUserFactory())
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("by_status", response.data)
        self.assertIn("pipeline_value", response.data)
        self.assertNotIn("margin", response.data)

    def test_owner_sees_margin(self):
        self.client.force_authenticate(OwnerUserFactory())
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("revenue", response.data)
        self.assertIn("margin", response.data)

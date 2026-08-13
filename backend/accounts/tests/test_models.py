from django.contrib.auth import get_user_model
from django.test import TestCase

from .factories import (
    TEST_PASSWORD,
    AdminUserFactory,
    OwnerUserFactory,
    StaffUserFactory,
    UserFactory,
)

User = get_user_model()


class UserModelTests(TestCase):
    """Covers the behaviour we added on top of AbstractUser."""

    def test_new_users_default_to_the_customer_role(self):
        # The default is a security property, not a convenience: if it were
        # ADMIN, every registration would hand out catalog write access.
        user = User.objects.create_user(username="newbie", email="n@fonix.test")
        self.assertEqual(user.role, User.Role.CUSTOMER)

    def test_passwords_are_hashed_not_stored_in_plain_text(self):
        user = UserFactory()
        self.assertNotEqual(user.password, TEST_PASSWORD)
        self.assertTrue(user.check_password(TEST_PASSWORD))

    def test_is_fonix_admin_is_false_for_a_customer(self):
        self.assertFalse(UserFactory().is_fonix_admin)

    def test_is_fonix_admin_is_true_for_the_admin_role(self):
        self.assertTrue(AdminUserFactory().is_fonix_admin)

    def test_is_fonix_admin_is_true_for_a_superuser_without_the_admin_role(self):
        """
        `createsuperuser` does not ask for our custom role field, so a superuser
        is created with role="customer". Locking the database owner out of the
        API they administer would be a surprising failure, so is_fonix_admin
        treats superusers as admins -- this test pins that decision down.
        """
        superuser = User.objects.create_superuser(
            username="root", email="root@fonix.test", password=TEST_PASSWORD
        )
        self.assertEqual(superuser.role, User.Role.CUSTOMER)
        self.assertTrue(superuser.is_fonix_admin)

    def test_email_must_be_unique(self):
        UserFactory(email="taken@fonix.test")
        with self.assertRaises(Exception):
            User.objects.create_user(
                username="other", email="taken@fonix.test", password=TEST_PASSWORD
            )


class RoleHierarchyTests(TestCase):
    """The rank ladder and the is_* gates it powers."""

    def test_role_rank_orders_the_hierarchy(self):
        self.assertEqual(UserFactory().role_rank, 0)
        self.assertEqual(StaffUserFactory().role_rank, 1)
        self.assertEqual(AdminUserFactory().role_rank, 2)
        self.assertEqual(OwnerUserFactory().role_rank, 3)

    def test_a_superuser_ranks_as_owner_regardless_of_role(self):
        superuser = User.objects.create_superuser(
            username="root", email="root@fonix.test", password=TEST_PASSWORD
        )
        self.assertEqual(superuser.role, User.Role.CUSTOMER)
        self.assertEqual(superuser.role_rank, 3)
        self.assertTrue(superuser.is_owner)

    def test_is_staff_member_is_true_from_staff_up(self):
        self.assertFalse(UserFactory().is_staff_member)
        self.assertTrue(StaffUserFactory().is_staff_member)
        self.assertTrue(AdminUserFactory().is_staff_member)
        self.assertTrue(OwnerUserFactory().is_staff_member)

    def test_is_admin_is_true_from_admin_up(self):
        self.assertFalse(UserFactory().is_admin)
        self.assertFalse(StaffUserFactory().is_admin)
        self.assertTrue(AdminUserFactory().is_admin)
        self.assertTrue(OwnerUserFactory().is_admin)

    def test_is_owner_is_true_only_for_owner(self):
        self.assertFalse(AdminUserFactory().is_owner)
        self.assertTrue(OwnerUserFactory().is_owner)

    def test_is_fonix_admin_still_aliases_is_admin(self):
        # The pre-hierarchy gate keeps meaning "admin or above", so the order
        # queryset and the older permission classes behave unchanged.
        self.assertFalse(StaffUserFactory().is_fonix_admin)
        self.assertTrue(AdminUserFactory().is_fonix_admin)
        self.assertTrue(OwnerUserFactory().is_fonix_admin)

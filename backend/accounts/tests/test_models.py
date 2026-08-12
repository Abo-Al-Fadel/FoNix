from django.contrib.auth import get_user_model
from django.test import TestCase

from .factories import TEST_PASSWORD, AdminUserFactory, UserFactory

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

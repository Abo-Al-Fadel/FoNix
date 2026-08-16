from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

User = get_user_model()


class SeedTeamCommandTests(TestCase):
    @override_settings(DEBUG=False)
    def test_refuses_to_run_when_debug_is_off(self):
        before = User.objects.count()

        with self.assertRaises(CommandError):
            call_command("seed_team", stdout=StringIO())

        self.assertEqual(User.objects.count(), before)

    @override_settings(DEBUG=True)
    def test_creates_demo_accounts_when_debug_is_on(self):
        call_command("seed_team", stdout=StringIO())

        self.assertTrue(User.objects.filter(username="owner").exists())
        self.assertTrue(User.objects.filter(username="admin").exists())
        self.assertTrue(User.objects.filter(username="staff").exists())

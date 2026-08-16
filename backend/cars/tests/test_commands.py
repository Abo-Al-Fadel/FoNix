from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings


class SeedCatalogCommandTests(TestCase):
    @override_settings(DEBUG=False)
    def test_refuses_to_run_when_debug_is_off(self):
        with self.assertRaises(CommandError):
            call_command("seed_catalog", stdout=StringIO())

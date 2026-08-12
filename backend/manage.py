#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys


def main():
    # We default to the *local* settings module rather than a single settings.py.
    # Production deployments are expected to set DJANGO_SETTINGS_MODULE explicitly
    # (e.g. config.settings.production), so a forgotten env var can never
    # accidentally boot a production box in DEBUG mode -- it can only ever
    # fail loudly or run local settings on a developer machine.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

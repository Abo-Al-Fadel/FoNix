#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys


def main():
    # manage.py defaults to local settings so `runserver` on a laptop is safe.
    # gunicorn / ASGI default to production (see wsgi.py / asgi.py) so a
    # forgotten DJANGO_SETTINGS_MODULE cannot boot DEBUG=True on a server.
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

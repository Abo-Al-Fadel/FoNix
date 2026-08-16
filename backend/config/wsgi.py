"""WSGI config -- the entry point a synchronous server (gunicorn, uWSGI) calls."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_wsgi_application()

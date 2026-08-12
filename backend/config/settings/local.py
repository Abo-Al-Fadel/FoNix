"""
Local development settings.

This is the only module in the project that is allowed to turn DEBUG on.
"""

from .base import *  # noqa: F401,F403
from .base import BASE_DIR, INSTALLED_APPS, MIDDLEWARE, env

DEBUG = True

# Safe to be permissive here because this module is never used on a server.
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]

# The Vite dev server. Still an explicit list rather than
# CORS_ALLOW_ALL_ORIGINS -- practising the habit in dev is how you avoid
# shipping a wildcard by muscle memory later.
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Credentialed requests are not used (we send JWTs in the Authorization header,
# not cookies), so this stays off.
CORS_ALLOW_CREDENTIALS = False

# SQLite by default so a fresh clone runs with zero setup. Point DATABASE_URL at
# Postgres to develop against the real production engine.
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}

# Print emails (e.g. password reset) to the console instead of sending them.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


# --------------------------------------------------------------------------- #
# django-debug-toolbar
# --------------------------------------------------------------------------- #
# The toolbar is how we *verify* the select_related/prefetch_related work in
# cars/views.py actually removed the N+1 queries, rather than assuming it did.
# Because the frontend is a separate SPA, the toolbar is most useful when you
# open an API URL (e.g. http://127.0.0.1:8000/api/cars/) directly in a browser
# with ?format=api, or via the SQL panel on the browsable API.

if DEBUG:
    INSTALLED_APPS = INSTALLED_APPS + ["debug_toolbar"]
    # Must come before CommonMiddleware can rewrite/redirect the request.
    MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE
    INTERNAL_IPS = ["127.0.0.1", "localhost"]

    # The toolbar only injects itself into HTML responses, and our default
    # renderer is JSON-only. Add the browsable API renderer in dev so that
    # hitting an endpoint in a browser gives us an HTML page the toolbar can
    # attach to (and a pleasant way to poke the API by hand).
    REST_FRAMEWORK = {  # noqa: F405
        **REST_FRAMEWORK,  # noqa: F405
        "DEFAULT_RENDERER_CLASSES": (
            "rest_framework.renderers.JSONRenderer",
            "rest_framework.renderers.BrowsableAPIRenderer",
        ),
    }

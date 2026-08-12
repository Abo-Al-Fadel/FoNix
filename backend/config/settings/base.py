"""
Base settings shared by every environment.

This module never enables DEBUG and never invents a SECRET_KEY. Anything that
differs between a laptop and a server lives in local.py / production.py, and
anything secret is read from the environment. That split is the whole point:
you can read this file and know it is safe to import anywhere.
"""

from datetime import timedelta
from pathlib import Path

import environ

# BASE_DIR points at `backend/` -- the directory containing manage.py.
# __file__ is .../backend/config/settings/base.py, so we walk up three parents.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    # Declaring the type and default here means env("DEBUG") returns a real bool,
    # not the string "False" (which is truthy and a classic source of a
    # production server accidentally running in debug mode).
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
)

# Read backend/.env if present. Deployed environments typically inject real
# environment variables instead of shipping this file, so its absence is fine.
environ.Env.read_env(BASE_DIR / ".env")

# SECURITY: no fallback value on purpose. If SECRET_KEY is missing the project
# refuses to start, which is far better than silently running on a default key
# that is identical on every checkout of this repo.
SECRET_KEY = env("SECRET_KEY")

# Overridden to True *only* in local.py.
DEBUG = False

ALLOWED_HOSTS = env("ALLOWED_HOSTS")


# --------------------------------------------------------------------------- #
# Applications
# --------------------------------------------------------------------------- #

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
]

LOCAL_APPS = [
    "accounts",
    "cars",
    "orders",
    "contact",
]

# Grouping them makes it obvious at a glance which apps we own and are therefore
# responsible for migrating, testing and reviewing.
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


MIDDLEWARE = [
    # CorsMiddleware must sit as high as possible -- specifically above
    # CommonMiddleware -- so that CORS headers are attached even to responses
    # that are short-circuited early (redirects, 404s). A CORS header added
    # after a redirect has already been returned is a header nobody sees.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
# env.db() parses a single DATABASE_URL string ("postgres://user:pass@host/db"
# or "sqlite:///db.sqlite3"). One variable instead of five, and it is the format
# every hosting provider hands you.

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}


# --------------------------------------------------------------------------- #
# Authentication
# --------------------------------------------------------------------------- #

# Swapping in a custom user model AFTER the first migration has been applied is
# genuinely painful -- it requires hand-written migrations and, in the worst
# case, a database rebuild. Setting it here before `makemigrations` has ever run
# costs nothing and buys us a `role` field (and anywhere else we want to grow
# the user) for free, forever.
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Django's default PBKDF2 hasher is deliberately kept -- it is well-audited and
# appropriate here. Changing hashers is a decision that needs a reason.


# --------------------------------------------------------------------------- #
# Internationalisation
# --------------------------------------------------------------------------- #

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "UTC"
USE_I18N = True
# Store every datetime in the database as UTC and convert at the edges. Naive
# local datetimes are a bug that only shows up twice a year.
USE_TZ = True


# --------------------------------------------------------------------------- #
# Static & media
# --------------------------------------------------------------------------- #

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Redirects uploads made during tests into a temporary directory instead of
# MEDIA_ROOT. See the docstring in config/test_runner.py.
TEST_RUNNER = "config.test_runner.MediaIsolatedTestRunner"


# --------------------------------------------------------------------------- #
# Django REST Framework
# --------------------------------------------------------------------------- #

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Default-deny. Every endpoint is locked unless a view opts out with an
    # explicit permission_classes -- the safe direction to fail in. The public
    # catalog endpoints opt out deliberately and visibly via IsAdminOrReadOnly.
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    # Rates are declared centrally so every throttled scope is visible in one
    # place. contact/views.py opts its public form into the "contact" scope.
    "DEFAULT_THROTTLE_RATES": {"contact": "5/hour"},
}

SIMPLE_JWT = {
    # Short-lived access tokens limit the blast radius of a leaked token; the
    # frontend silently trades the refresh token for a new one when it expires.
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # Each refresh issues a brand-new refresh token and blacklists nothing --
    # rotation alone already means a stolen refresh token is only useful until
    # the legitimate client next refreshes.
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}


# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #
# Never a wildcard, not even in development (see local.py for the dev origins).
# The frontend and backend are separate origins in this architecture, so this is
# load-bearing, not boilerplate.

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

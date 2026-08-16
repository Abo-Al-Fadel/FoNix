"""
Production settings.

DEBUG is False with no escape hatch. Missing ALLOWED_HOSTS, CORS, DATABASE_URL
or FRONTEND_ORIGIN must crash the process -- a default here would ship a
misconfigured box.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import MIDDLEWARE, env

DEBUG = False

ALLOWED_HOSTS = [host for host in env("ALLOWED_HOSTS") if host]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS must be set in production.")

# Railway's health check and public URL use this hostname. Appending it means
# a forgotten extra host does not 400 the platform probe.
_railway_host = env("RAILWAY_PUBLIC_DOMAIN", default="")
if _railway_host and _railway_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, _railway_host]

CORS_ALLOWED_ORIGINS = [origin for origin in env("CORS_ALLOWED_ORIGINS") if origin]
if not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must be set in production.")

FRONTEND_ORIGIN = env("FRONTEND_ORIGIN")
if not FRONTEND_ORIGIN:
    raise ImproperlyConfigured("FRONTEND_ORIGIN must be set in production.")
if "localhost" in FRONTEND_ORIGIN or "127.0.0.1" in FRONTEND_ORIGIN:
    raise ImproperlyConfigured(
        "FRONTEND_ORIGIN still points at localhost. Set it to the public site."
    )

# Django admin POSTs (login) fail CSRF on HTTPS unless this lists the API
# origin. Railway's public domain is added automatically when present.
CSRF_TRUSTED_ORIGINS = [
    origin for origin in env.list("CSRF_TRUSTED_ORIGINS", default=[]) if origin
]
if _railway_host:
    _railway_origin = f"https://{_railway_host}"
    if _railway_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, _railway_origin]
if not CSRF_TRUSTED_ORIGINS:
    raise ImproperlyConfigured(
        "CSRF_TRUSTED_ORIGINS must be set in production "
        "(https://your-api-host). Needed for /admin/."
    )

# No SQLite fallback at runtime. An empty DATABASE_URL would otherwise be
# filled from a leftover .env. sqlite is accepted only so `collectstatic`
# can boot during the Docker build (see backend/Dockerfile).
_database_url = env("DATABASE_URL", default="")
if not _database_url:
    raise ImproperlyConfigured("DATABASE_URL must be set in production.")
DATABASES = {"default": env.db("DATABASE_URL")}


# --------------------------------------------------------------------------- #
# HTTPS / transport security
# --------------------------------------------------------------------------- #

SECURE_SSL_REDIRECT = True
# Railway (and most platforms) probe health over plain HTTP inside the mesh.
# Redirecting that to https makes the service look down forever.
SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

# Behind a reverse proxy Django sees plain HTTP; this header is how the proxy
# tells it the original request was HTTPS. Only safe when the proxy strips a
# client-supplied copy.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# WhiteNoise serves /static/ (Django admin CSS) from this process so we do not
# need a second nginx container for that. User uploads stay on MEDIA_ROOT /
# object storage -- WhiteNoise is not a media CDN.
if "whitenoise.middleware.WhiteNoiseMiddleware" not in MIDDLEWARE:
    _security = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
    MIDDLEWARE = list(MIDDLEWARE)
    MIDDLEWARE.insert(_security + 1, "whitenoise.middleware.WhiteNoiseMiddleware")

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="FoNix <noreply@localhost>")
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {process:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

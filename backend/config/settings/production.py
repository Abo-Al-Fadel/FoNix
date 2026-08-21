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

# Some platforms publish the service's own hostname at runtime (Render sets
# RENDER_EXTERNAL_HOSTNAME, Railway sets RAILWAY_PUBLIC_DOMAIN). Appending it
# means the platform's health probe and public URL work without the operator
# having to know the generated hostname in advance -- so on Render you can leave
# ALLOWED_HOSTS unset and the service still answers on its onrender.com URL.
_platform_hosts = [
    env(var, default="")
    for var in ("RENDER_EXTERNAL_HOSTNAME", "RAILWAY_PUBLIC_DOMAIN")
]
_platform_hosts = [host for host in _platform_hosts if host]
for _host in _platform_hosts:
    if _host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS = [*ALLOWED_HOSTS, _host]

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS must be set in production (or run on a platform that "
        "publishes its hostname, e.g. Render)."
    )

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
# origin. The platform hostname (Render/Railway) is added automatically when
# present, so /admin/ login works on the generated URL without extra config.
CSRF_TRUSTED_ORIGINS = [
    origin for origin in env.list("CSRF_TRUSTED_ORIGINS", default=[]) if origin
]
for _host in _platform_hosts:
    _origin = f"https://{_host}"
    if _origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, _origin]
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

# Single-container hosts (Render, Fly, a bare VM without Caddy) have no separate
# web server for /media/, so Django serves it. Off by default: the Docker
# Compose deploy uses Caddy for media and must not double-serve it. See
# config/urls.py. Set SERVE_MEDIA=1 on hosts that need it.
SERVE_MEDIA = env.bool("SERVE_MEDIA", default=False)

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

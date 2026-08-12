"""
Production settings.

Deployment is explicitly out of scope for v1 (see the build brief), so this
module is not exercised by any running environment yet. It exists so that the
security posture is written down and DEBUG has a home that is unambiguously
False -- and so that "deploy it" later is a configuration task, not a
refactor.
"""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# No default. A production boot with an unset ALLOWED_HOSTS should crash, not
# fall back to ["*"] and happily serve any Host header thrown at it.
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# Likewise: the real frontend origin(s), never a wildcard.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")


# --------------------------------------------------------------------------- #
# HTTPS / transport security
# --------------------------------------------------------------------------- #

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Tell browsers to refuse plain HTTP for this domain for a year. Start with a
# small max-age when first enabling this on a real domain -- it is difficult to
# undo, because browsers cache the directive.
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Behind a reverse proxy (nginx, a PaaS router) Django sees plain HTTP; this
# header is how the proxy tells it the original request was HTTPS. Only safe
# when the proxy is guaranteed to strip a client-supplied copy of the header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #
# With DEBUG off, unhandled exceptions are otherwise silent. Log to stdout so a
# container platform can collect them.

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

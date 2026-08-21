"""
Root URL configuration.

Every app owns its own urls.py and is mounted here under a single prefix. The
alternative -- declaring every route centrally -- means this file has to change
every time any app grows an endpoint.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as media_serve

from config.health import health

urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/admin/", include("accounts.admin_urls")),
    path("api/cars/", include("cars.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/contact/", include("contact.urls")),
]

# Serving user media.
#
# The Docker Compose deploy puts Caddy in front of MEDIA_ROOT, so Django never
# serves media there. A single-container host (Render, Fly, a bare dyno) has no
# such front, so Django has to serve it. SERVE_MEDIA turns that on. It is fine
# for a low-traffic portfolio; a busy site would put object storage or a CDN in
# front instead. In local development DEBUG does the same thing.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif getattr(settings, "SERVE_MEDIA", False):
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            media_serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]

if settings.DEBUG:

    # debug_toolbar is only installed under local settings.
    if "debug_toolbar" in settings.INSTALLED_APPS:
        urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]

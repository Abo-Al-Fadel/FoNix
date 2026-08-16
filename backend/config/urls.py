"""
Root URL configuration.

Every app owns its own urls.py and is mounted here under a single prefix. The
alternative -- declaring every route centrally -- means this file has to change
every time any app grows an endpoint.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

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

if settings.DEBUG:
    # Django does not serve user-uploaded media in production -- a real deploy
    # puts nginx or object storage in front of MEDIA_ROOT. This helper exists
    # purely so car images load on a developer machine, and it is a no-op when
    # DEBUG is False.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    # debug_toolbar is only installed under local settings.
    if "debug_toolbar" in settings.INSTALLED_APPS:
        urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]

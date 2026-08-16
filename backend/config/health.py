"""Liveness for the load balancer. No versions, no DEBUG, no engine names."""

from django.db import connection
from django.db.utils import InterfaceError, OperationalError
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@require_GET
@never_cache
def health(_request):
    try:
        connection.ensure_connection()
    except (OperationalError, InterfaceError):
        return JsonResponse({"ok": False}, status=503)
    return JsonResponse({"ok": True})

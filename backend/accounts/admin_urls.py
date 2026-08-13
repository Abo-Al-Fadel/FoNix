"""
The control-panel API surface, mounted at /api/admin/.

Kept separate from accounts/urls.py (which is the public auth surface: register,
login, me) so the two never blur together. This is where future dashboard
endpoints -- stats, the audit log -- will join, all behind the admin/owner gate.
"""

from rest_framework.routers import DefaultRouter

from .views import UserAdminViewSet

app_name = "admin_api"

router = DefaultRouter()
router.register("users", UserAdminViewSet, basename="admin-user")

urlpatterns = router.urls

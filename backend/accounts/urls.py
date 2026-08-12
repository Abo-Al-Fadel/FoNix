from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, MeView, RegisterView

# Namespacing lets templates and tests reverse these as "accounts:login"
# instead of relying on a bare name that another app might also use.
app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    # simplejwt's stock view is fine here -- we add nothing to the refresh
    # exchange, so subclassing it would be noise.
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
]

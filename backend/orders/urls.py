from rest_framework.routers import DefaultRouter

from .views import OrderViewSet

app_name = "orders"

router = DefaultRouter()
# basename is required because this ViewSet defines get_queryset() rather than a
# static `queryset` attribute -- the router has no model to infer route names
# from, so we name them ourselves ("orders:order-list", "orders:order-detail").
router.register(r"", OrderViewSet, basename="order")

urlpatterns = router.urls

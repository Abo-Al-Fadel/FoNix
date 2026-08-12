from rest_framework.routers import DefaultRouter

from .views import CarModelViewSet

app_name = "cars"

# The router generates the URL patterns for every ViewSet action and names them
# consistently ("cars:carmodel-list", "cars:carmodel-detail"), which is what
# lets the tests reverse() these routes instead of hardcoding URL strings that
# silently rot when a path changes.
router = DefaultRouter()
# An empty prefix because config/urls.py already mounts this module at
# /api/cars/ -- a prefix of "cars" here would produce /api/cars/cars/.
router.register(r"", CarModelViewSet, basename="carmodel")

urlpatterns = router.urls

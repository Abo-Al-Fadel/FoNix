from rest_framework import viewsets

from .models import CarModel
from .permissions import IsAdminOrReadOnly
from .serializers import CarDetailSerializer, CarListSerializer


class CarModelViewSet(viewsets.ModelViewSet):
    """
    The catalog endpoint: /api/cars/

    A ModelViewSet gives all six actions (list, retrieve, create, update,
    partial_update, destroy) from one class, wired to URLs by the router in
    urls.py. The permission class decides which of them a given caller may
    reach, so there is no per-action boilerplate here at all -- that is what
    "thin views" looks like in DRF.
    """

    permission_classes = [IsAdminOrReadOnly]

    # Look cars up by slug instead of the default pk, so URLs read
    # /api/cars/ignis/ and the frontend can route on the same human-readable
    # identifier it puts in its own URLs.
    lookup_field = "slug"

    def get_queryset(self):
        """
        Build the queryset per action so each one fetches exactly what it needs.

        The N+1 problem this avoids: without prefetch_related, serializing a
        detail response touches car.images.all(), which is a second query. On a
        list endpoint that becomes 1 query for the cars plus 1 per car -- 21
        queries for a page of 20. prefetch_related turns that into 2 queries
        total by fetching all the related images in one IN (...) lookup.

        The list endpoint does not serialize images at all (CarListSerializer
        omits them), so prefetching there would be a wasted query -- hence the
        branch rather than a blanket .prefetch_related() on both. Verify either
        claim with django-debug-toolbar's SQL panel, don't take it on trust.

        No select_related is needed anywhere here: CarModel has no forward
        ForeignKey. It would be cargo-culting to add one.
        """
        queryset = CarModel.objects.all()
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("images")
        return queryset

    def get_serializer_class(self):
        # The light serializer for the grid, the full one for a product page.
        if self.action == "list":
            return CarListSerializer
        return CarDetailSerializer

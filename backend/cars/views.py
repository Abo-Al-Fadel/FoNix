from rest_framework import viewsets

from .models import CarModel
from .permissions import IsStaffOrReadOnly
from .serializers import CarAdminSerializer, CarDetailSerializer, CarListSerializer


class CarModelViewSet(viewsets.ModelViewSet):
    """
    The catalog endpoint: /api/cars/

    A ModelViewSet gives all six actions (list, retrieve, create, update,
    partial_update, destroy) from one class, wired to URLs by the router in
    urls.py. The permission class decides which of them a given caller may
    reach, so there is no per-action boilerplate here at all -- that is what
    "thin views" looks like in DRF.

    Staff see more than the public does, through the same endpoint: hidden
    (unpublished) cars, and the internal `cost`/`is_published` fields. That is
    driven by the caller's role in get_queryset and get_serializer_class rather
    than a separate admin route, so there is one catalogue API, not two to keep
    in sync.
    """

    permission_classes = [IsStaffOrReadOnly]

    # Look cars up by slug instead of the default pk, so URLs read
    # /api/cars/ignis/ and the frontend can route on the same human-readable
    # identifier it puts in its own URLs.
    lookup_field = "slug"

    def _is_staff(self) -> bool:
        user = self.request.user
        return bool(user and user.is_authenticated and user.is_staff_member)

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

        Visibility: the public only ever sees published cars. Staff see every
        car, so they can find and un-hide a retired one. Filtering in the
        queryset (not the serializer) means a hidden car is a 404 to a shopper
        who guesses its slug, not merely absent from the list.
        """
        queryset = CarModel.objects.all()
        if not self._is_staff():
            queryset = queryset.filter(is_published=True)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("images", "options")
        return queryset

    def get_serializer_class(self):
        # Staff get the fuller admin serializer for every action: it carries the
        # cost and is_published fields they manage, and makes thumbnail_alt
        # writable. The public gets the light grid serializer for the list and
        # the read-only detail serializer for a product page.
        if self._is_staff():
            return CarAdminSerializer
        if self.action == "list":
            return CarListSerializer
        return CarDetailSerializer

from rest_framework import mixins, permissions, viewsets

from .models import Order
from .permissions import IsOrderOwnerOrAdmin
from .serializers import OrderCreateSerializer, OrderReadSerializer


class OrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/orders/ -- create and read orders.

    Composed from individual mixins rather than subclassing ModelViewSet,
    because ModelViewSet would also expose update and destroy. A customer being
    able to DELETE their own order record, or PATCH its status to "confirmed",
    is not a feature -- and the safest way to not ship an endpoint is to not
    generate it. Cancellation, when it exists, should be an explicit action with
    its own rules, not a raw DELETE.
    """

    permission_classes = [permissions.IsAuthenticated, IsOrderOwnerOrAdmin]

    def get_queryset(self):
        """
        Scoping happens here, in the queryset, not in a filter applied to
        results afterwards. That way the restriction is impossible to bypass:
        every action on this ViewSet -- list, retrieve, and anything added later
        -- inherits it automatically.

        .with_items() preloads the item rows and their cars; see the docstring
        on OrderQuerySet for the N+1 this prevents when computing Order.total.
        """
        return Order.objects.with_items().for_user(self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderReadSerializer

    def perform_create(self, serializer):
        """
        Inject the owner from the authenticated request.

        This is the hook DRF provides precisely so that server-controlled fields
        never have to appear in the serializer's writable fields. `user` is not
        an input the client can supply, so there is no way to place an order on
        another account.
        """
        serializer.save(user=self.request.user)

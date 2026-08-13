from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin

from .models import Order
from .permissions import IsOrderOwnerOrAdmin
from .serializers import (
    OrderAdminSerializer,
    OrderCreateSerializer,
    OrderReadSerializer,
    OrderStatusUpdateSerializer,
)


class OrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/orders/ -- create and read orders, plus admin status tracking.

    Composed from individual mixins rather than subclassing ModelViewSet,
    because ModelViewSet would also expose update and destroy. A customer being
    able to DELETE their own order record, or PATCH its status to "confirmed",
    is not a feature -- and the safest way to not ship an endpoint is to not
    generate it. Advancing an order through the fulfilment lifecycle is instead
    an explicit admin-only action (`status`) with its own transition rules.
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
        for_user() returns every order to an admin and only their own to a
        customer.
        """
        return Order.objects.with_items().for_user(self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        if self.action == "set_status":
            return OrderStatusUpdateSerializer
        # Admins get the fuller serializer with the customer's identity so the
        # tracking view can show whose order it is; customers get their own
        # read shape, which has no business naming anyone.
        user = self.request.user
        if user and user.is_authenticated and user.is_admin:
            return OrderAdminSerializer
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

    @action(
        detail=True,
        methods=["patch"],
        url_path="status",
        permission_classes=[permissions.IsAuthenticated, IsAdmin],
    )
    def set_status(self, request, pk=None):
        """
        PATCH /api/orders/{id}/status/ -- advance an order's fulfilment stage.

        Admin-only (a customer must never move their own order to "confirmed").
        The requested status must be both a valid choice (serializer) and a
        legal next step from where the order currently is (model). An illegal
        hop -- say Delivered back to Pending -- is a 400, not a silent no-op.
        """
        order = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        if new_status == order.status:
            return Response(
                {"status": [f"The order is already {order.get_status_display()}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not order.can_transition_to(new_status):
            allowed = order.ALLOWED_TRANSITIONS.get(order.status, [])
            allowed_labels = ", ".join(Order.Status(s).label for s in allowed) or "none"
            return Response(
                {
                    "status": [
                        f"Cannot move a {order.get_status_display()} order to "
                        f"{Order.Status(new_status).label}. Allowed from here: {allowed_labels}."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = new_status
        order.save(update_fields=["status"])
        # Echo the full order back in the admin read shape for the tracking UI.
        return Response(OrderAdminSerializer(order, context=self.get_serializer_context()).data)

from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin, IsStaffMember

from .models import Order, OrderEvent
from .notify import notify_order_placed, notify_order_status
from .permissions import IsOrderOwnerOrAdmin
from .serializers import (
    HangarNoteSerializer,
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
    because ModelViewSet would also expose update and destroy.
    """

    permission_classes = [permissions.IsAuthenticated, IsOrderOwnerOrAdmin]

    def get_queryset(self):
        queryset = Order.objects.with_items()
        mine = self.request.query_params.get("mine")
        if mine in ("1", "true"):
            return queryset.filter(user=self.request.user)
        return queryset.for_user(self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        if self.action == "set_status":
            return OrderStatusUpdateSerializer
        if self.action == "add_note":
            return HangarNoteSerializer
        user = self.request.user
        if user and user.is_authenticated and user.is_staff_member:
            return OrderAdminSerializer
        return OrderReadSerializer

    def perform_create(self, serializer):
        order = serializer.save(user=self.request.user)
        notify_order_placed(order)

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
        permission_classes=[permissions.IsAuthenticated, IsOrderOwnerOrAdmin],
    )
    def cancel(self, request, pk=None):
        """POST /api/orders/{id}/cancel/ -- buyer unwind, pending only."""
        order = self.get_object()
        if order.user_id != request.user.id:
            return Response(
                {"detail": "Only the buyer can cancel this way. Staff use the status action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if order.status != Order.Status.PENDING:
            return Response(
                {
                    "status": [
                        "Only a pending allocation can be cancelled by the customer."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.transition_to(
            Order.Status.CANCELLED,
            actor=request.user,
            note="Cancelled by the customer",
        )
        event = order.events.order_by("-at", "-id").first()
        notify_order_status(order, event)
        return Response(
            OrderReadSerializer(order, context=self.get_serializer_context()).data
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path="status",
        permission_classes=[permissions.IsAuthenticated, IsAdmin],
    )
    def set_status(self, request, pk=None):
        """PATCH /api/orders/{id}/status/ -- admin/owner fulfilment only."""
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

        note = "Cancelled by FoNix" if new_status == Order.Status.CANCELLED else ""
        order.transition_to(new_status, actor=request.user, note=note)
        event = order.events.order_by("-at", "-id").first()
        notify_order_status(order, event)
        return Response(
            OrderAdminSerializer(order, context=self.get_serializer_context()).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="note",
        permission_classes=[permissions.IsAuthenticated, IsStaffMember],
    )
    def add_note(self, request, pk=None):
        """POST /api/orders/{id}/note/ -- hangar remark, no status change."""
        order = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        OrderEvent.objects.create(
            order=order,
            from_status=order.status,
            to_status=order.status,
            actor=request.user,
            note=serializer.validated_data["note"],
        )
        return Response(
            OrderAdminSerializer(order, context=self.get_serializer_context()).data
        )

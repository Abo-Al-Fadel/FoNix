import logging
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db.models import (
    Count,
    DecimalField,
    F,
    OuterRef,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import generics, mixins, permissions, status, throttling, viewsets
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.views import TokenObtainPairView

from orders.models import OrderItem

from .permissions import CanManageUser, IsAdmin
from .serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserAdminSerializer,
    UserSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def revoke_refresh_tokens(user):
    """Invalidate outstanding refresh tokens after a password change."""
    for outstanding in OutstandingToken.objects.filter(user_id=user.pk):
        BlacklistedToken.objects.get_or_create(token=outstanding)


class AuthLoginThrottle(throttling.AnonRateThrottle):
    """Stop credential stuffing. Contact already has a 5/hour cap; login had none."""

    scope = "auth_login"


class AuthRegisterThrottle(throttling.AnonRateThrottle):
    """Same idea for the public register endpoint."""

    scope = "auth_register"


class AuthPasswordResetThrottle(throttling.AnonRateThrottle):
    """Password-reset email is a delivery channel; cap it like contact."""

    scope = "auth_password_reset"


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/

    A generic view, not an APIView with a hand-written post(). CreateAPIView
    already implements "deserialize, validate, save, return 201 with the
    serialized object" -- rewriting that by hand is how subtle differences in
    status codes and error shapes creep between endpoints.
    """

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    # Explicitly public: overrides the project-wide IsAuthenticated default,
    # which would otherwise make it impossible to sign up without an account.
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRegisterThrottle]


class FoNixTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Adds the user's identity to the login response.

    Without this, the frontend gets two opaque token strings back and has to
    make a second round-trip to /api/auth/me/ just to render "Hi, <name>" in
    the navbar. Embedding `role` in the token payload as well means permission
    checks in the UI don't need a network call either.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Claims added here are signed into the JWT itself. Never put anything
        # secret in here -- a JWT payload is base64, not encrypted, and any
        # client can read it.
        token["username"] = user.username
        token["role"] = user.role
        return token

    def validate(self, attrs: dict) -> dict:
        data = super().validate(attrs)
        # self.user is set by the parent's validate() once credentials check out.
        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ -- exchanges username + password for a token pair."""

    serializer_class = FoNixTokenObtainPairSerializer
    throttle_classes = [AuthLoginThrottle]


class PasswordResetRequestView(generics.GenericAPIView):
    """
    POST /api/auth/password-reset/

    Always returns 200. Telling a caller whether an email is registered is an
    account-enumeration leak.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthPasswordResetThrottle]
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            origin = settings.FRONTEND_ORIGIN.rstrip("/")
            link = f"{origin}/reset-password?uid={uid}&token={token}"
            try:
                send_mail(
                    subject="Reset your FoNix password",
                    message=(
                        "A password reset was requested for this FoNix account.\n\n"
                        f"{link}\n\n"
                        "If that URL wrapped in a log, use these values on "
                        f"{origin}/reset-password\n"
                        f"uid: {uid}\n"
                        f"token: {token}\n\n"
                        "If you did not ask for this, you can ignore the message."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                )
            except Exception:
                # A 500 here would tell an attacker the address is registered.
                logger.exception(
                    "Password reset email failed for user id %s", user.pk
                )
        return Response(
            {"detail": "If that account exists, we sent instructions."}
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """POST /api/auth/password-reset/confirm/"""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthPasswordResetThrottle]
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        revoke_refresh_tokens(user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/auth/me/

    There is no `pk` in the URL on purpose. The object is always derived from
    the authenticated token, so there is no id for a caller to tamper with in
    order to read someone else's profile.
    """

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/admin/users/ -- the control panel's user management.

    List and read every account; change a user's role or active state. No
    create (accounts are made by registering) and no destroy (Order.user is
    PROTECT, so a customer with orders cannot be deleted anyway -- the panel
    deactivates instead, which is what real shops do). Update is PATCH-only in
    practice; the serializer makes everything but role/is_active read-only.

    Two permission layers stack here:
      - IsAdmin gates the endpoint to admins and owners.
      - CanManageUser adds the object-level who-may-touch-whom rules (no acting
        on yourself; only an owner may act on another owner).
    The what-may-this-change-to rules (role ceiling, last-owner protection) live
    in UserAdminSerializer.
    """

    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin, CanManageUser]

    def get_queryset(self):
        # total_spent as a correlated subquery, not a join-and-Sum: summing over
        # orders__items in the same annotate as Count("orders") would fan the
        # rows out and multiply both figures. The subquery aggregates each user's
        # line items independently, so the two annotations stay correct.
        spent_per_user = (
            OrderItem.objects.filter(order__user=OuterRef("pk"))
            .values("order__user")
            .annotate(
                total=Sum(
                    F("price_at_purchase") * F("quantity"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                )
            )
            .values("total")
        )
        return User.objects.annotate(
            order_count=Count("orders", distinct=True),
            total_spent=Coalesce(
                Subquery(
                    spent_per_user,
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                Value(Decimal("0.00"), output_field=DecimalField(
                    max_digits=14, decimal_places=2
                )),
            ),
        ).order_by("-date_joined")


class HangarStatsView(generics.GenericAPIView):
    """
    GET /api/admin/stats/

    Operational counts for admin and owner. Build cost and margin are owner-only
    — that figure is what a shop floor must not leak.
    """

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from cars.models import CarModel
        from orders.models import Order

        status_rows = {
            row["status"]: row["n"]
            for row in Order.objects.values("status").annotate(n=Count("id"))
        }
        by_status = {
            key: status_rows.get(key, 0) for key, _label in Order.Status.choices
        }
        live = CarModel.objects.filter(is_published=True)
        pipeline = OrderItem.objects.exclude(
            order__status=Order.Status.CANCELLED
        ).aggregate(
            total=Coalesce(
                Sum(
                    F("price_at_purchase") * F("quantity"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                Value(Decimal("0.00"), output_field=DecimalField(
                    max_digits=14, decimal_places=2
                )),
            )
        )["total"]

        payload = {
            "orders_total": Order.objects.count(),
            "by_status": by_status,
            "in_progress": Order.objects.exclude(
                status__in=[Order.Status.DELIVERED, Order.Status.CANCELLED]
            ).count(),
            "cars_live": live.count(),
            "slots_remaining": live.aggregate(s=Sum("slots_remaining"))["s"] or 0,
            "accounts": User.objects.count(),
            "pipeline_value": str(pipeline),
        }

        if request.user.is_owner:
            recognised = OrderItem.objects.filter(
                order__status__in=[
                    Order.Status.CONFIRMED,
                    Order.Status.IN_PRODUCTION,
                    Order.Status.IN_TRANSIT,
                    Order.Status.DELIVERED,
                ]
            ).select_related("car")
            revenue = Decimal("0.00")
            cost = Decimal("0.00")
            for item in recognised:
                revenue += item.subtotal
                if item.car.cost is not None:
                    cost += item.car.cost * item.quantity
            deposits = Order.objects.filter(
                payment_status=Order.PaymentStatus.AUTHORIZED
            ).exclude(status=Order.Status.CANCELLED).aggregate(
                s=Coalesce(
                    Sum("deposit_amount"),
                    Value(Decimal("0.00"), output_field=DecimalField(
                        max_digits=14, decimal_places=2
                    )),
                )
            )["s"]
            payload["revenue"] = str(revenue)
            payload["build_cost"] = str(cost)
            payload["margin"] = str(revenue - cost)
            payload["deposits_authorised"] = str(deposits)

        return Response(payload)

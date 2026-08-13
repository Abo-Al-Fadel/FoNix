from decimal import Decimal

from django.contrib.auth import get_user_model
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
from rest_framework import generics, mixins, permissions, viewsets
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from orders.models import OrderItem

from .permissions import CanManageUser, IsAdmin
from .serializers import RegisterSerializer, UserAdminSerializer, UserSerializer

User = get_user_model()


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

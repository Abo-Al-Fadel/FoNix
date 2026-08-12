from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

# get_user_model() rather than importing User directly. It resolves
# AUTH_USER_MODEL at call time, so this module keeps working if the user model
# ever moves, and it avoids circular imports in apps that Django loads early.
User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of a user, returned by /api/auth/me/."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role")
        # role is server-controlled. If it were writable, a customer could PATCH
        # themselves to admin -- the classic mass-assignment privilege
        # escalation. Promotion happens in the Django admin, not over the API.
        read_only_fields = ("id", "role")


class RegisterSerializer(serializers.ModelSerializer):
    """
    Handles POST /api/auth/register/.

    Validation lives here rather than in the view: a serializer is the layer
    that owns "is this input acceptable and what does it turn into", which
    keeps the view down to a few lines (the "thin views" rule).
    """

    password = serializers.CharField(
        write_only=True,
        # style= only affects the browsable API's rendered form -- it masks the
        # input instead of showing the password in plain text while you test.
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
        )
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "email": {"required": True},
        }

    def validate_password(self, value: str) -> str:
        """
        Run Django's configured password validators (length, common-password
        blocklist, all-numeric...) from AUTH_PASSWORD_VALIDATORS.

        DRF does not do this for you: ModelSerializer only enforces the
        *database* constraints on the field, and a CharField's only database
        constraint is max_length. Without this hook, "1" would be a valid
        password over the API while being rejected in the Django admin.
        """
        validate_password(value)
        return value

    def validate(self, attrs: dict) -> dict:
        """
        Cross-field validation goes in validate(), not validate_<field>(),
        because a single field's validator cannot see the other fields.
        """
        if attrs["password"] != attrs["password_confirm"]:
            # Attaching the error to the confirm field (rather than raising a
            # non-field error) is what lets the frontend highlight the specific
            # input that is wrong.
            raise serializers.ValidationError(
                {"password_confirm": "The two password fields didn't match."}
            )
        return attrs

    def create(self, validated_data: dict) -> User:
        # password_confirm is a serializer-only field; the model has no such
        # column, so it must be discarded before we build the User.
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        # create_user(), never User(**data).save(): the manager method hashes
        # the password. Assigning to `password` directly stores the raw string
        # in the database and produces an account nobody can ever log into.
        user = User.objects.create_user(**validated_data, password=password)

        # Registration always produces a customer. Handing the role out from
        # request data would let anyone POST themselves an admin account.
        user.role = User.Role.CUSTOMER
        user.save(update_fields=["role"])
        return user

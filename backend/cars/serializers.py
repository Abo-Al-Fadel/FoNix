from rest_framework import serializers

from .models import CarImage, CarModel, CarOption

SPEC_FIELDS = (
    "power_kw",
    "torque_nm",
    "weight_kg",
    "battery_kwh",
    "charge_10_80_min",
    "ac_kw",
    "length_mm",
    "width_mm",
    "height_mm",
    "seats",
    "drivetrain",
    "motor_count",
    "body_style",
    "warranty_years",
    "service_interval",
    "country_of_build",
    "homologation",
)

ALLOCATION_FIELDS = (
    "allocation_open",
    "slots_remaining",
    "lead_time_weeks",
    "max_order_quantity",
)


class CarImageSerializer(serializers.ModelSerializer):
    alt_text = serializers.CharField(source="resolved_alt_text", read_only=True)

    class Meta:
        model = CarImage
        fields = ("id", "image", "alt_text", "display_order")


class CarOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarOption
        fields = ("id", "category", "name", "price_delta", "is_default", "sort_order")


class CarListSerializer(serializers.ModelSerializer):
    thumbnail_alt = serializers.CharField(source="alt_text", read_only=True)

    class Meta:
        model = CarModel
        fields = (
            "id",
            "name",
            "slug",
            "tagline",
            "base_price",
            "range_km",
            "top_speed_kmh",
            "acceleration_0_100",
            "thumbnail",
            "thumbnail_alt",
            "is_hero",
            "has_real_imagery",
            "body_style",
            *ALLOCATION_FIELDS,
        )


class CarAdminSerializer(serializers.ModelSerializer):
    images = CarImageSerializer(many=True, read_only=True)
    options = CarOptionSerializer(many=True, read_only=True)

    class Meta:
        model = CarModel
        fields = (
            "id",
            "name",
            "slug",
            "tagline",
            "description",
            "base_price",
            "cost",
            "range_km",
            "top_speed_kmh",
            "acceleration_0_100",
            *SPEC_FIELDS,
            *ALLOCATION_FIELDS,
            "thumbnail",
            "thumbnail_alt",
            "is_hero",
            "has_real_imagery",
            "is_published",
            "images",
            "options",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
        extra_kwargs = {
            "slug": {"required": False},
        }

    def validate(self, attrs: dict) -> dict:
        """
        MSRP and build cost are a pricing decision. Hangar staff may update
        specs, slots and photography; they may not rewrite what a car sells for.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and not user.is_admin):
            return attrs
        blocked = {}
        if "cost" in attrs:
            incoming = attrs["cost"]
            current = getattr(self.instance, "cost", None)
            if self.instance is None or incoming != current:
                blocked["cost"] = (
                    "Only an admin or owner can set build cost. "
                    "Staff may update specification, imagery and slots."
                )
                attrs.pop("cost")
        if self.instance is not None and "base_price" in attrs:
            if attrs["base_price"] != self.instance.base_price:
                blocked["base_price"] = (
                    "Only an admin or owner can change the list price. "
                    "Staff may update specification, imagery and slots."
                )
                attrs.pop("base_price")
        if blocked:
            raise serializers.ValidationError(blocked)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and user.is_admin):
            data.pop("cost", None)
        return data


class CarDetailSerializer(serializers.ModelSerializer):
    images = CarImageSerializer(many=True, read_only=True)
    options = CarOptionSerializer(many=True, read_only=True)
    thumbnail_alt = serializers.CharField(source="alt_text", read_only=True)

    class Meta:
        model = CarModel
        fields = (
            "id",
            "name",
            "slug",
            "tagline",
            "description",
            "base_price",
            "range_km",
            "top_speed_kmh",
            "acceleration_0_100",
            *SPEC_FIELDS,
            *ALLOCATION_FIELDS,
            "thumbnail",
            "thumbnail_alt",
            "is_hero",
            "has_real_imagery",
            "images",
            "options",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
        extra_kwargs = {
            "slug": {"required": False},
        }

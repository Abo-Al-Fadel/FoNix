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

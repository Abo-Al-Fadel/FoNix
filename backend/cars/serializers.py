from rest_framework import serializers

from .models import CarImage, CarModel


class CarImageSerializer(serializers.ModelSerializer):
    # A method field so the API always sends a usable alt string, resolving the
    # model's fallback server-side. The frontend should never have to decide
    # what to do with an empty alt attribute.
    alt_text = serializers.CharField(source="resolved_alt_text", read_only=True)

    class Meta:
        model = CarImage
        fields = ("id", "image", "alt_text", "display_order")


class CarListSerializer(serializers.ModelSerializer):
    """
    Catalog-card representation. Deliberately smaller than the detail
    serializer: the store grid needs a price and a thumbnail, not a 400-word
    description or a full gallery for every card.

    Two serializers instead of one is not duplication -- it is the list
    endpoint refusing to pay for data nobody renders.
    """

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
        )


class CarDetailSerializer(serializers.ModelSerializer):
    """
    Full product page payload, including the nested gallery.

    `images` is read-only nested output. Writable nested serializers require a
    custom create()/update() to handle the child rows, and gallery images are
    managed in the Django admin here -- so making it read-only is an honest
    description of what the endpoint actually supports rather than a broken
    half-implementation.
    """

    images = CarImageSerializer(many=True, read_only=True)
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
            "thumbnail",
            "thumbnail_alt",
            "is_hero",
            "has_real_imagery",
            "images",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
        extra_kwargs = {
            # Optional on write so an admin can POST a car and let the model's
            # save() derive the slug from the name.
            "slug": {"required": False},
        }

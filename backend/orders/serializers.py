from rest_framework import serializers

from cars.models import CarModel

from .models import Order, OrderItem


class OrderItemReadSerializer(serializers.ModelSerializer):
    """How a line item is rendered back to the client."""

    car_name = serializers.CharField(source="car.name", read_only=True)
    car_slug = serializers.SlugField(source="car.slug", read_only=True)
    # The image is nullable in principle; source="car.thumbnail" would raise if
    # the car had no file, so we keep it simple and let DRF render the URL.
    car_thumbnail = serializers.ImageField(source="car.thumbnail", read_only=True)
    # DecimalField mirrors the model's precision so the total arrives as the
    # string "2400000.00" rather than a float the client has to re-round.
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "car_slug",
            "car_name",
            "car_thumbnail",
            "quantity",
            "price_at_purchase",
            "subtotal",
        )


class OrderItemWriteSerializer(serializers.Serializer):
    """
    One entry of the incoming cart payload.

    A plain Serializer, not a ModelSerializer: the client sends only a car and a
    quantity. price_at_purchase is emphatically *not* an input -- accepting it
    would let a caller name their own price. Modelling the write shape
    separately from the model is what makes that impossible by construction
    rather than by remembering to strip a field.
    """

    car = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=CarModel.objects.all(),
        # SlugRelatedField turns "ignis" into a CarModel instance and returns a
        # clean 400 for a slug that doesn't exist -- no manual .get() plus
        # DoesNotExist handling in the view.
        help_text="Slug of the car being ordered, e.g. 'ignis'.",
    )
    quantity = serializers.IntegerField(
        min_value=1,
        max_value=10,
        # An upper bound is validation, not paranoia: without it a typo (or a
        # bored visitor) can post quantity=999999999 and overflow the order
        # total past the DecimalField's max_digits, which fails at the database
        # with a 500 instead of a helpful 400.
    )


class OrderReadSerializer(serializers.ModelSerializer):
    """Full order representation for GET /api/orders/ and /api/orders/{id}/."""

    items = OrderItemReadSerializer(many=True, read_only=True)
    # Reads Order.total -- the model property. The number the customer sees is
    # the same number every other part of the system computes.
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "status",
            "status_display",
            "created_at",
            "items",
            "item_count",
            "total",
        )
        read_only_fields = fields


class OrderCreateSerializer(serializers.Serializer):
    """
    POST /api/orders/ -- turns a client-side cart into a persisted order.

    The cart lives in the browser (React state + localStorage) until this
    moment; there is no server-side Cart model in v1. So the entire cart
    arrives here in one request and becomes an Order plus its OrderItems
    atomically.
    """

    items = OrderItemWriteSerializer(many=True)

    def validate_items(self, value: list[dict]) -> list[dict]:
        if not value:
            # An order with no lines would have a total of £0 and no meaning.
            raise serializers.ValidationError("An order must contain at least one car.")

        # OrderItem has a UniqueConstraint on (order, car). Catching a duplicate
        # here gives a readable 400; letting it reach the database gives an
        # IntegrityError and a 500.
        slugs = [item["car"].slug for item in value]
        if len(slugs) != len(set(slugs)):
            raise serializers.ValidationError(
                "Each car may appear only once; use quantity for multiples."
            )
        return value

    def create(self, validated_data: dict) -> Order:
        # The view passes the authenticated user in via serializer.save(user=...)
        # -- it is never read from the request body, so a caller cannot place an
        # order in somebody else's name.
        return Order.create_from_cart(
            user=validated_data["user"],
            cart_items=validated_data["items"],
        )

    def to_representation(self, instance: Order) -> dict:
        """
        Echo the created order back in its full read shape.

        Without this, DRF would try to serialize the new Order using *this*
        serializer's fields and return the cart payload it was handed, not the
        order id, status and total the frontend needs for the confirmation
        screen.
        """
        return OrderReadSerializer(instance, context=self.context).data

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from cars.models import CarModel, CarOption

from .models import DeliveryDetail, Order, OrderEvent, OrderItem


class OrderItemReadSerializer(serializers.ModelSerializer):
    car_name = serializers.CharField(source="car.name", read_only=True)
    car_slug = serializers.SlugField(source="car.slug", read_only=True)
    car_thumbnail = serializers.ImageField(source="car.thumbnail", read_only=True)
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
            "options",
            "subtotal",
        )


class DeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryDetail
        fields = (
            "method",
            "full_name",
            "phone",
            "line1",
            "city",
            "postcode",
            "country",
        )

    def validate(self, attrs: dict) -> dict:
        if attrs.get("method") == DeliveryDetail.Method.DELIVER:
            missing = [field for field in ("line1", "city", "postcode") if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError(
                    {field: "Required when the car is delivered." for field in missing}
                )
        return attrs


class OrderEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderEvent
        fields = ("id", "from_status", "to_status", "at", "actor_name", "note")
        read_only_fields = fields

    def get_actor_name(self, obj: OrderEvent) -> str:
        if obj.actor_id is None:
            return "FoNix"
        if obj.actor.role in ("staff", "admin", "owner") or obj.actor.is_superuser:
            return "FoNix"
        return obj.actor.get_full_name() or obj.actor.username


class OrderItemWriteSerializer(serializers.Serializer):
    car = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=CarModel.objects.filter(is_published=True),
    )
    quantity = serializers.IntegerField(min_value=1, max_value=2)
    option_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs: dict) -> dict:
        car = attrs["car"]
        quantity = attrs["quantity"]
        if not car.allocation_open:
            raise serializers.ValidationError(
                {"car": f"{car.name} is not taking allocations."}
            )
        if quantity > car.max_order_quantity:
            raise serializers.ValidationError(
                {
                    "quantity": (
                        f"{car.name} is limited to {car.max_order_quantity} per order."
                    )
                }
            )
        if car.slots_remaining < quantity:
            raise serializers.ValidationError(
                {
                    "quantity": (
                        f"{car.name} has {car.slots_remaining} allocation(s) left."
                    )
                }
            )

        option_ids = attrs.pop("option_ids", None)
        options = []
        if option_ids:
            options = list(CarOption.objects.filter(pk__in=option_ids, car=car))
            if len(options) != len(set(option_ids)):
                raise serializers.ValidationError(
                    {"option_ids": "One or more options do not belong to this car."}
                )
            categories = [option.category for option in options]
            if len(categories) != len(set(categories)):
                raise serializers.ValidationError(
                    {"option_ids": "Choose one option per category."}
                )

        chosen = {option.category for option in options}
        for default in CarOption.objects.filter(car=car, is_default=True):
            if default.category not in chosen:
                options.append(default)
        attrs["options"] = options
        return attrs


class OrderReadSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)
    delivery = serializers.SerializerMethodField()
    events = OrderEventSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    can_cancel = serializers.SerializerMethodField()

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
            "delivery",
            "events",
            "can_cancel",
        )
        read_only_fields = fields

    def get_delivery(self, obj: Order) -> dict | None:
        try:
            return DeliverySerializer(obj.delivery).data
        except ObjectDoesNotExist:
            return None

    def get_can_cancel(self, obj: Order) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and obj.user_id == user.id
            and obj.status == Order.Status.PENDING
        )


class OrderAdminSerializer(OrderReadSerializer):
    customer = serializers.CharField(source="user.username", read_only=True)
    customer_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(OrderReadSerializer.Meta):
        fields = OrderReadSerializer.Meta.fields + ("customer", "customer_email")
        read_only_fields = fields


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemWriteSerializer(many=True)
    delivery = DeliverySerializer()

    def validate_items(self, value: list[dict]) -> list[dict]:
        if not value:
            raise serializers.ValidationError("An order must contain at least one car.")
        slugs = [item["car"].slug for item in value]
        if len(slugs) != len(set(slugs)):
            raise serializers.ValidationError(
                "Each car may appear only once; use quantity for multiples."
            )
        return value

    def create(self, validated_data: dict) -> Order:
        try:
            return Order.create_from_cart(
                user=validated_data["user"],
                cart_items=validated_data["items"],
                delivery=validated_data["delivery"],
            )
        except ValueError as exc:
            raise serializers.ValidationError({"items": str(exc)}) from exc

    def to_representation(self, instance: Order) -> dict:
        return OrderReadSerializer(instance, context=self.context).data

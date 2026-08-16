from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.db.models import F

from cars.models import CarModel


class OrderQuerySet(models.QuerySet):
    """
    Query helpers live on the QuerySet so they chain
    (`Order.objects.for_user(u).with_items()`), which a plain Manager method
    cannot do.
    """

    def with_items(self):
        """
        Preload the item rows and each item's car in one go.

        Order.total iterates self.items.all(), and every OrderItem serializer
        reads item.car.name. Without this, rendering a list of 10 orders is
        1 query for the orders + 10 for their items + one per item for the car.
        prefetch_related handles the reverse FK (items); the nested
        select_related("car") is applied to that prefetch's own query, so the
        cars come back with the items instead of one lookup at a time.
        """
        return self.select_related("user", "delivery").prefetch_related(
            models.Prefetch(
                "items",
                queryset=OrderItem.objects.select_related("car"),
            ),
            models.Prefetch(
                "events",
                queryset=OrderEvent.objects.select_related("actor"),
            ),
        )

    def for_user(self, user):
        """
        Scope orders to what `user` is allowed to see.

        # DECISION: staff and above see every order (staff read-only in the
        # panel; admin/owner change status). Customers see only their own.
        """
        if user.is_staff_member:
            return self
        return self.filter(user=user)


class Order(models.Model):
    """A placed order. No payment is taken -- v1 stops at recording intent."""

    class Status(models.TextChoices):
        # The fulfilment lifecycle of a built-to-order hypercar. Ordered as the
        # journey runs; ALLOWED_TRANSITIONS below encodes which hops are legal.
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        IN_PRODUCTION = "in_production", "In production"
        IN_TRANSIT = "in_transit", "In transit"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    # Which status a given status may move to. The happy path steps forward one
    # stage at a time; an order may be cancelled from any stage that has not yet
    # been delivered; delivered and cancelled are terminal (empty lists). Keeping
    # this as data -- rather than a tangle of ifs in the view -- means the rule is
    # inspectable in one place and easy to test exhaustively.
    ALLOWED_TRANSITIONS = {
        Status.PENDING: [Status.CONFIRMED, Status.CANCELLED],
        Status.CONFIRMED: [Status.IN_PRODUCTION, Status.CANCELLED],
        Status.IN_PRODUCTION: [Status.IN_TRANSIT, Status.CANCELLED],
        Status.IN_TRANSIT: [Status.DELIVERED, Status.CANCELLED],
        Status.DELIVERED: [],
        Status.CANCELLED: [],
    }

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # PROTECT, not CASCADE. If a user account is ever deleted, cascading
        # would silently delete their order history with it -- destroying the
        # financial record of a sale that really happened. PROTECT turns that
        # into a loud error that forces a deliberate decision (anonymise the
        # order, or refuse the deletion) instead of quiet data loss.
        on_delete=models.PROTECT,
        related_name="orders",
    )
    status = models.CharField(
        # 20, not 10: "in_production" is 13 characters. A too-narrow status
        # column is the kind of bug that only shows up the first time someone
        # advances an order to that exact stage.
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrderQuerySet.as_manager()

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Order #{self.pk} - {self.user.username} ({self.status})"

    @property
    def total(self) -> Decimal:
        """
        The order's value.

        This is the "fat models" rule in practice: the total is computed here,
        on the model, so the serializer, the Django admin and any future
        invoice/email all read the same number from the same code. The moment
        this logic is copied into a view, two of the three places will
        eventually disagree.

        Note it sums the *stored* line prices, not the cars' current prices --
        see OrderItem.price_at_purchase.
        """
        # start=Decimal("0.00") keeps the result a Decimal even for an empty
        # order; sum()'s default start of int 0 would return an int there and
        # give the caller two different types depending on the data.
        return sum((item.subtotal for item in self.items.all()), Decimal("0.00"))

    @property
    def item_count(self) -> int:
        return sum(item.quantity for item in self.items.all())

    def can_transition_to(self, new_status: str) -> bool:
        """Whether this order may legally move to `new_status` from where it is."""
        return new_status in self.ALLOWED_TRANSITIONS.get(self.status, [])

    def release_slots(self):
        """Return held build slots. Safe to call only when leaving a live order."""
        for item in self.items.all():
            CarModel.objects.filter(pk=item.car_id).update(
                slots_remaining=F("slots_remaining") + item.quantity
            )

    def transition_to(self, new_status: str, *, actor, note: str = "") -> None:
        """Move status, restore slots on cancel, and record who did it."""
        old_status = self.status
        if new_status != old_status and not self.can_transition_to(new_status):
            raise ValueError(
                f"Cannot move a {self.get_status_display()} order to "
                f"{self.Status(new_status).label}."
            )
        if new_status == self.Status.CANCELLED and old_status != self.Status.CANCELLED:
            self.release_slots()
        self.status = new_status
        self.save(update_fields=["status", "updated_at"])
        OrderEvent.objects.create(
            order=self,
            from_status=old_status,
            to_status=new_status,
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            note=note,
        )

    @classmethod
    @transaction.atomic
    def create_from_cart(
        cls, *, user, cart_items: list[dict], delivery: dict
    ) -> "Order":
        """
        Hold slots, snapshot prices (base + options), and store handover details.

        cart_items is a list of
        {"car": CarModel, "quantity": int, "options": list[CarOption]}.
        """
        order = cls.objects.create(user=user)
        DeliveryDetail.objects.create(order=order, **delivery)

        lines = []
        for item in cart_items:
            car = CarModel.objects.select_for_update().get(pk=item["car"].pk)
            quantity = item["quantity"]
            if not car.is_published or not car.allocation_open:
                raise ValueError(f"{car.name} is not taking allocations.")
            if quantity > car.max_order_quantity:
                raise ValueError(
                    f"{car.name} is limited to {car.max_order_quantity} per order."
                )
            if car.slots_remaining < quantity:
                raise ValueError(
                    f"{car.name} has {car.slots_remaining} slot(s) left."
                )
            car.slots_remaining -= quantity
            car.save(update_fields=["slots_remaining"])

            extra = Decimal("0.00")
            snapshot = []
            for option in item.get("options") or []:
                extra += option.price_delta
                snapshot.append(
                    {
                        "id": option.pk,
                        "category": option.category,
                        "name": option.name,
                        "price_delta": str(option.price_delta),
                    }
                )

            lines.append(
                OrderItem(
                    order=order,
                    car=car,
                    quantity=quantity,
                    price_at_purchase=car.base_price + extra,
                    options=snapshot,
                )
            )

        OrderItem.objects.bulk_create(lines)
        OrderEvent.objects.create(
            order=order,
            from_status="",
            to_status=cls.Status.PENDING,
            actor=user,
            note="Allocation requested",
        )
        return order


class OrderItem(models.Model):
    """One line on an order: a car, a quantity, and the price when it sold."""

    order = models.ForeignKey(
        Order,
        related_name="items",
        # CASCADE is right here and PROTECT is not: a line item has no
        # existence independent of its order, so deleting an order should take
        # its lines with it rather than orphan them.
        on_delete=models.CASCADE,
    )
    car = models.ForeignKey(
        CarModel,
        # PROTECT again. Retiring a model from the catalog must never erase the
        # line items recording that people bought it. This is why the store
        # should soft-retire cars rather than delete them -- and PROTECT is what
        # makes that constraint impossible to forget.
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text=(
            "Copy of the car's price at the moment of ordering, including "
            "selected options. Denormalised on purpose: reading the live price "
            "instead would silently rewrite historical orders every time the "
            "catalog price changed."
        ),
    )
    options = models.JSONField(
        default=list,
        blank=True,
        help_text="Snapshot of selected options at purchase. Not a live FK.",
    )

    class Meta:
        constraints = [
            # Enforced by the database, so it holds even for a bulk_create, a
            # data migration, or someone typing SQL by hand -- none of which go
            # through a serializer's validation.
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="orderitem_quantity_at_least_one",
            ),
            # One line per car per order; quantity carries the count. Without
            # this, a cart bug could produce two separate lines for the same car
            # and the order would look duplicated.
            models.UniqueConstraint(
                fields=("order", "car"), name="orderitem_unique_car_per_order"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.quantity} x {self.car.name}"

    @property
    def subtotal(self) -> Decimal:
        return self.quantity * self.price_at_purchase


class DeliveryDetail(models.Model):
    """Where this allocation goes. Snapshot at checkout, not a live profile."""

    class Method(models.TextChoices):
        COLLECT = "collect", "Hangar collection"
        DELIVER = "deliver", "Delivered"

    order = models.OneToOneField(
        Order, related_name="delivery", on_delete=models.CASCADE
    )
    method = models.CharField(
        max_length=20, choices=Method.choices, default=Method.COLLECT
    )
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=40, blank=True)
    line1 = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=80, blank=True)
    postcode = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=80, default="United Kingdom")

    def __str__(self) -> str:
        return f"Delivery for order #{self.order_id}"


class OrderEvent(models.Model):
    """One status change, with who did it. The buyer-visible timeline."""

    order = models.ForeignKey(
        Order, related_name="events", on_delete=models.CASCADE
    )
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="order_events",
    )
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ("at", "id")

    def __str__(self) -> str:
        return f"Order #{self.order_id}: {self.from_status} → {self.to_status}"

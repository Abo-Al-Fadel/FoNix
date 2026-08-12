from decimal import Decimal

from django.conf import settings
from django.db import models, transaction

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
        return self.prefetch_related(
            models.Prefetch(
                "items",
                queryset=OrderItem.objects.select_related("car"),
            )
        )

    def for_user(self, user):
        """
        Scope orders to what `user` is allowed to see.

        DECISION (was an open question in the build brief): FoNix admins see
        every order; customers see only their own. An admin is the person who
        fulfils orders, so an order list they cannot read would make the role
        useless. Customers are hard-scoped here rather than relying on the
        frontend to only ask for its own -- a caller can always change the URL.
        """
        if user.is_fonix_admin:
            return self
        return self.filter(user=user)


class Order(models.Model):
    """A placed order. No payment is taken -- v1 stops at recording intent."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"

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
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

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

    @classmethod
    @transaction.atomic
    def create_from_cart(cls, *, user, cart_items: list[dict]) -> "Order":
        """
        Build an Order and its OrderItems from a validated cart payload.

        `cart_items` is a list of {"car": <CarModel>, "quantity": int}.

        Two things make this a model method rather than serializer code:

        1. @transaction.atomic. An order is meaningless without its lines. If
           creating the third OrderItem fails, the whole thing must roll back
           rather than leaving a £2m order with two of its three cars in the
           database.
        2. The price snapshot below is a business rule, and business rules
           belong with the data they govern.
        """
        order = cls.objects.create(user=user)

        OrderItem.objects.bulk_create(
            [
                OrderItem(
                    order=order,
                    car=item["car"],
                    quantity=item["quantity"],
                    # Read from the database record, never from the request.
                    # A client that could send its own price could buy a
                    # hypercar for £1. This is the single most important line
                    # in the checkout flow.
                    price_at_purchase=item["car"].base_price,
                )
                for item in cart_items
            ]
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
            "Copy of the car's price at the moment of ordering. Denormalised on "
            "purpose: reading the live price instead would silently rewrite "
            "historical orders every time the catalog price changed."
        ),
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

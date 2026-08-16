from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.test import TestCase

from accounts.tests.factories import StaffUserFactory, UserFactory
from cars.tests.factories import CarModelFactory
from orders.models import Order, OrderItem

from .factories import OrderFactory, OrderItemFactory

COLLECT = {
    "method": "collect",
    "full_name": "Ada Lovelace",
    "phone": "0117 000 0000",
    "country": "United Kingdom",
}


class OrderTotalTests(TestCase):
    """The "fat model" business logic: money."""

    def test_subtotal_multiplies_quantity_by_the_stored_price(self):
        item = OrderItemFactory(quantity=3, price_at_purchase=Decimal("100.50"))

        self.assertEqual(item.subtotal, Decimal("301.50"))

    def test_total_sums_every_line(self):
        order = OrderFactory()
        OrderItemFactory(order=order, quantity=2, price_at_purchase=Decimal("1000.00"))
        OrderItemFactory(order=order, quantity=1, price_at_purchase=Decimal("500.25"))

        self.assertEqual(order.total, Decimal("2500.25"))

    def test_total_of_an_empty_order_is_a_decimal_zero(self):
        """
        sum()'s default start value is the integer 0, which would make `total`
        return an int for an empty order and a Decimal otherwise. Callers
        should never have to handle two types.
        """
        total = OrderFactory().total

        self.assertEqual(total, Decimal("0.00"))
        self.assertIsInstance(total, Decimal)

    def test_item_count_sums_quantities_not_lines(self):
        order = OrderFactory()
        OrderItemFactory(order=order, quantity=2)
        OrderItemFactory(order=order, quantity=3)

        self.assertEqual(order.item_count, 5)


class OrderCreationTests(TestCase):
    """Order.create_from_cart -- the checkout entry point."""

    def test_it_creates_the_order_and_all_of_its_lines(self):
        user = UserFactory()
        ignis = CarModelFactory(base_price=Decimal("2400000.00"))
        aurea = CarModelFactory(base_price=Decimal("890000.00"), max_order_quantity=2)

        order = Order.create_from_cart(
            user=user,
            cart_items=[
                {"car": ignis, "quantity": 1},
                {"car": aurea, "quantity": 2},
            ],
            delivery=COLLECT,
        )

        self.assertEqual(order.user, user)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(order.items.count(), 2)
        self.assertEqual(order.total, Decimal("4180000.00"))

    def test_the_line_price_is_snapshotted_from_the_database_record(self):
        user = UserFactory()
        car = CarModelFactory(base_price=Decimal("2400000.00"))

        order = Order.create_from_cart(
            user=user,
            cart_items=[{"car": car, "quantity": 1}],
            delivery=COLLECT,
        )

        self.assertEqual(order.items.first().price_at_purchase, Decimal("2400000.00"))

    def test_a_later_price_change_does_not_rewrite_a_placed_order(self):
        """
        This is the entire reason price_at_purchase exists as a stored column
        instead of a lookup through to car.base_price.
        """
        user = UserFactory()
        car = CarModelFactory(base_price=Decimal("2400000.00"))
        order = Order.create_from_cart(
            user=user,
            cart_items=[{"car": car, "quantity": 1}],
            delivery=COLLECT,
        )

        car.base_price = Decimal("3000000.00")
        car.save()

        order.refresh_from_db()
        self.assertEqual(order.total, Decimal("2400000.00"))


class OrderConstraintTests(TestCase):
    def test_a_car_cannot_appear_twice_on_one_order(self):
        order = OrderFactory()
        car = CarModelFactory()
        OrderItemFactory(order=order, car=car)

        # atomic() wraps the failing statement so the test's outer transaction
        # survives -- without it, the broken transaction poisons every
        # subsequent query in this test.
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrderItemFactory(order=order, car=car)

    def test_quantity_must_be_at_least_one(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrderItemFactory(quantity=0)


class OnDeleteBehaviourTests(TestCase):
    """
    Pins down the deliberate on_delete choices. These are the tests that would
    catch someone "tidying up" a PROTECT into a CASCADE.
    """

    def test_a_user_with_orders_cannot_be_deleted(self):
        order = OrderFactory()

        with self.assertRaises(ProtectedError):
            order.user.delete()

        self.assertEqual(Order.objects.count(), 1)

    def test_a_car_that_has_been_ordered_cannot_be_deleted(self):
        item = OrderItemFactory()

        with self.assertRaises(ProtectedError):
            item.car.delete()

        self.assertEqual(OrderItem.objects.count(), 1)

    def test_deleting_an_order_deletes_its_lines(self):
        """CASCADE is correct in this direction: a line has no life of its own."""
        order = OrderFactory()
        OrderItemFactory(order=order)

        order.delete()

        self.assertEqual(OrderItem.objects.count(), 0)


class OrderScopingTests(TestCase):
    """OrderQuerySet.for_user -- the visibility rule, tested at the data layer."""

    def test_a_customer_sees_only_their_own_orders(self):
        mine = OrderFactory()
        OrderFactory()  # someone else's

        visible = Order.objects.for_user(mine.user)

        self.assertEqual(list(visible), [mine])

    def test_an_admin_sees_every_order(self):
        from accounts.tests.factories import AdminUserFactory

        OrderFactory()
        OrderFactory()
        admin = AdminUserFactory()

        self.assertEqual(Order.objects.for_user(admin).count(), 2)

    def test_a_staff_member_sees_every_order(self):
        OrderFactory()
        OrderFactory()
        staff = StaffUserFactory()

        self.assertEqual(Order.objects.for_user(staff).count(), 2)

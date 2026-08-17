from decimal import Decimal

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import AdminUserFactory, StaffUserFactory, UserFactory
from cars.tests.factories import CarModelFactory, CarOptionFactory
from orders.models import Order

from .factories import OrderFactory, OrderItemFactory

COLLECT = {
    "method": "collect",
    "full_name": "Ada Lovelace",
    "phone": "0117 000 0000",
    "country": "United Kingdom",
}

PAYMENT = {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2030,
    "cvc": "123",
    "name": "Ada Lovelace",
}


class OrderCreateAPITests(APITestCase):
    """POST /api/orders/ -- the checkout endpoint."""

    def setUp(self):
        self.url = reverse("orders:order-list")
        self.user = UserFactory()
        self.ignis = CarModelFactory(name="Ignis", base_price=Decimal("2400000.00"))
        self.aurea = CarModelFactory(name="Aurea", base_price=Decimal("890000.00"))

    def place(self, items, delivery=None, **extra):
        payload = {
            "items": items,
            "delivery": delivery or COLLECT,
            "payment": extra.pop("payment", PAYMENT),
            **extra,
        }
        return self.client.post(self.url, payload, format="json")

    def test_anonymous_users_cannot_place_an_order(self):
        response = self.place([{"car": self.ignis.slug, "quantity": 1}])

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_authenticated_customer_can_place_an_order(self):
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [
                {"car": self.ignis.slug, "quantity": 1},
                {"car": self.aurea.slug, "quantity": 1},
            ]
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get()
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.items.count(), 2)
        self.assertEqual(order.delivery.method, "collect")
        self.assertTrue(order.events.exists())
        self.assertEqual(order.payment_status, Order.PaymentStatus.AUTHORIZED)
        self.assertEqual(order.payment_last4, "4242")
        self.assertEqual(order.deposit_amount, Decimal("329000.00"))
        self.assertNotIn("4242424242424242", str(response.data))

    def test_the_response_is_the_full_order_not_the_cart_payload(self):
        """The confirmation screen needs an id and a total, not an echo of the
        request body -- that is what OrderCreateSerializer.to_representation
        is for."""
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": self.ignis.slug, "quantity": 1}])

        self.assertIn("id", response.data)
        self.assertEqual(response.data["total"], "2400000.00")
        self.assertEqual(response.data["deposit_amount"], "240000.00")
        self.assertEqual(response.data["payment_last4"], "4242")
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["items"][0]["car_name"], "Ignis")
        self.assertTrue(response.data["can_cancel"])

    def test_a_client_supplied_price_is_ignored(self):
        """
        The most important test in the suite. If price_at_purchase were ever
        accepted from the request body, anyone could buy a hypercar for a pound.
        """
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [
                {
                    "car": self.ignis.slug,
                    "quantity": 1,
                    "price_at_purchase": "1.00",
                }
            ]
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Order.objects.get().items.first().price_at_purchase,
            Decimal("2400000.00"),
        )

    def test_option_deltas_are_snapshotted_onto_the_line_price(self):
        ember = CarOptionFactory(
            car=self.ignis,
            name="Ember",
            price_delta=Decimal("12400.00"),
            is_default=False,
        )
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [{"car": self.ignis.slug, "quantity": 1, "option_ids": [ember.pk]}]
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = Order.objects.get().items.get()
        self.assertEqual(item.price_at_purchase, Decimal("2412400.00"))
        self.assertEqual(item.options[0]["name"], "Ember")

    def test_a_client_cannot_place_an_order_on_someone_elses_account(self):
        victim = UserFactory()
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [{"car": self.ignis.slug, "quantity": 1}],
            user=victim.id,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.get().user, self.user)

    def test_an_empty_cart_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.place([])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_missing_delivery_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url,
            {"items": [{"car": self.ignis.slug, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_deliver_without_an_address_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [{"car": self.ignis.slug, "quantity": 1}],
            delivery={
                "method": "deliver",
                "full_name": "Ada Lovelace",
                "country": "United Kingdom",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_unknown_car_slug_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": "not-a-real-car", "quantity": 1}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_unpublished_car_is_not_orderable(self):
        hidden = CarModelFactory(name="Ghost", is_published=False)
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": hidden.slug, "quantity": 1}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_closed_allocation_is_rejected(self):
        self.ignis.allocation_open = False
        self.ignis.save(update_fields=["allocation_open"])
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": self.ignis.slug, "quantity": 1}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_duplicated_car_gets_a_readable_400_not_a_database_error(self):
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [
                {"car": self.ignis.slug, "quantity": 1},
                {"car": self.ignis.slug, "quantity": 1},
            ]
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_zero_quantity_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": self.ignis.slug, "quantity": 0}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantity_above_the_car_cap_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": self.ignis.slug, "quantity": 2}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_absurd_quantity_is_rejected_before_it_reaches_the_database(self):
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": self.ignis.slug, "quantity": 999999999}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversubscribing_the_last_slot_is_rejected(self):
        self.ignis.slots_remaining = 0
        self.ignis.save(update_fields=["slots_remaining"])
        self.client.force_authenticate(user=self.user)

        response = self.place([{"car": self.ignis.slug, "quantity": 1}])

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_placing_an_order_holds_a_build_slot(self):
        self.ignis.slots_remaining = 4
        self.ignis.save(update_fields=["slots_remaining"])
        self.client.force_authenticate(user=self.user)

        self.place([{"car": self.ignis.slug, "quantity": 1}])

        self.ignis.refresh_from_db()
        self.assertEqual(self.ignis.slots_remaining, 3)

    def test_a_failed_order_leaves_nothing_behind(self):
        """
        Atomicity check. The first line is valid and the second is not, so the
        serializer rejects the whole request -- there must be no half-written
        order with one of its two cars.
        """
        self.client.force_authenticate(user=self.user)

        self.place(
            [
                {"car": self.ignis.slug, "quantity": 1},
                {"car": "not-a-real-car", "quantity": 1},
            ]
        )

        self.assertEqual(Order.objects.count(), 0)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_placing_an_order_sends_the_buyer_an_email(self):
        self.client.force_authenticate(user=self.user)

        self.place([{"car": self.ignis.slug, "quantity": 1}])

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("allocation", mail.outbox[0].subject.lower())

    def test_a_declined_demo_card_takes_no_slot(self):
        self.ignis.slots_remaining = 4
        self.ignis.save(update_fields=["slots_remaining"])
        self.client.force_authenticate(user=self.user)

        response = self.place(
            [{"car": self.ignis.slug, "quantity": 1}],
            payment={**PAYMENT, "number": "4000000000000002"},
        )

        self.assertEqual(response.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(Order.objects.count(), 0)
        self.ignis.refresh_from_db()
        self.assertEqual(self.ignis.slots_remaining, 4)

    def test_missing_payment_is_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            self.url,
            {
                "items": [{"car": self.ignis.slug, "quantity": 1}],
                "delivery": COLLECT,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_phone_number_is_required(self):
        self.client.force_authenticate(user=self.user)
        response = self.place(
            [{"car": self.ignis.slug, "quantity": 1}],
            delivery={**COLLECT, "phone": ""},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)


class OrderListAPITests(APITestCase):
    """GET /api/orders/ -- scoping is the whole story here."""

    def setUp(self):
        self.url = reverse("orders:order-list")
        self.user = UserFactory()

    def test_anonymous_users_are_rejected(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_customer_sees_only_their_own_orders(self):
        mine = OrderFactory(user=self.user)
        OrderFactory()  # another customer's order
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], mine.id)

    def test_an_admin_sees_every_order(self):
        OrderFactory()
        OrderFactory()
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.get(self.url)

        self.assertEqual(len(response.data["results"]), 2)

    def test_a_staff_member_sees_every_order(self):
        OrderFactory()
        OrderFactory()
        self.client.force_authenticate(user=StaffUserFactory())

        response = self.client.get(self.url)

        self.assertEqual(len(response.data["results"]), 2)
        self.assertIn("customer", response.data["results"][0])

    def test_mine_scopes_even_staff_to_their_own_orders(self):
        mine = OrderFactory(user=self.user)
        OrderFactory()
        staff = StaffUserFactory()
        OrderFactory(user=staff)
        self.client.force_authenticate(user=staff)

        response = self.client.get(self.url, {"mine": "1"})

        self.assertEqual(len(response.data["results"]), 1)
        self.assertNotEqual(response.data["results"][0]["id"], mine.id)

    def test_listing_orders_does_not_scale_its_query_count_with_the_order_count(self):
        """
        Order.total walks order.items, and each item renders its car's name --
        the textbook N+1. OrderQuerySet.with_items() collapses it to a fixed
        number of queries no matter how many orders come back.

        Four queries with force_authenticate: the paginator COUNT, the orders
        page (with user + delivery), one prefetch for items+cars, one for events.
        """
        for _ in range(5):
            order = OrderFactory(user=self.user)
            OrderItemFactory(order=order)
            OrderItemFactory(order=order)
        self.client.force_authenticate(user=self.user)

        with self.assertNumQueries(4):
            self.client.get(self.url)


class OrderDetailAPITests(APITestCase):
    """GET /api/orders/{id}/"""

    def setUp(self):
        self.user = UserFactory()
        self.order = OrderFactory(user=self.user)
        OrderItemFactory(order=self.order)
        self.url = reverse("orders:order-detail", kwargs={"pk": self.order.pk})

    def test_a_customer_can_read_their_own_order(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.order.id)

    def test_another_customers_order_is_a_404_not_a_403(self):
        """
        A 403 would confirm the order exists. A 404 -- which falls out of the
        scoped queryset for free -- tells a stranger nothing at all.
        """
        self.client.force_authenticate(user=UserFactory())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_an_admin_can_read_any_order(self):
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_staff_member_can_read_any_order(self):
        self.client.force_authenticate(user=StaffUserFactory())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class OrderMutationTests(APITestCase):
    """
    The ViewSet is built from Create/List/Retrieve mixins only. These tests
    document that update and destroy are genuinely absent rather than merely
    undocumented -- a customer must not be able to mark their own order
    "confirmed" or delete the record of it.
    """

    def setUp(self):
        self.user = UserFactory()
        self.order = OrderFactory(user=self.user)
        self.url = reverse("orders:order-detail", kwargs={"pk": self.order.pk})
        self.client.force_authenticate(user=self.user)

    def test_an_order_cannot_be_patched(self):
        response = self.client.patch(self.url, {"status": "confirmed"})

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING)

    def test_an_order_cannot_be_deleted(self):
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(Order.objects.count(), 1)


class OrderCustomerCancelTests(APITestCase):
    """POST /api/orders/{id}/cancel/ -- buyer unwind, pending only."""

    def setUp(self):
        self.user = UserFactory()
        self.car = CarModelFactory(slots_remaining=5)
        self.client.force_authenticate(user=self.user)
        self.create_url = reverse("orders:order-list")

    def _place(self):
        response = self.client.post(
            self.create_url,
            {
                "items": [{"car": self.car.slug, "quantity": 1}],
                "delivery": COLLECT,
                "payment": PAYMENT,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return Order.objects.get(pk=response.data["id"])

    def test_the_buyer_can_cancel_a_pending_order_and_the_slot_returns(self):
        order = self._place()
        self.car.refresh_from_db()
        self.assertEqual(self.car.slots_remaining, 4)

        url = reverse("orders:order-cancel", kwargs={"pk": order.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.car.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.assertEqual(self.car.slots_remaining, 5)
        self.assertFalse(response.data["can_cancel"])

    def test_the_buyer_cannot_cancel_once_the_hangar_has_confirmed(self):
        order = self._place()
        order.transition_to(Order.Status.CONFIRMED, actor=AdminUserFactory())
        url = reverse("orders:order-cancel", kwargs={"pk": order.pk})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CONFIRMED)

    def test_staff_cannot_use_the_buyer_cancel_on_someone_elses_order(self):
        order = self._place()
        self.client.force_authenticate(user=StaffUserFactory())
        url = reverse("orders:order-cancel", kwargs={"pk": order.pk})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)


class OrderStatusTrackingTests(APITestCase):
    """PATCH /api/orders/{id}/status/ -- the admin fulfilment action."""

    def setUp(self):
        self.customer = UserFactory()
        self.order = OrderFactory(user=self.customer)
        self.url = reverse("orders:order-set-status", kwargs={"pk": self.order.pk})

    def test_a_customer_cannot_advance_their_own_order(self):
        # The whole point of a status field is that the shop controls it, not
        # the buyer. A customer marking their own order "confirmed" is exactly
        # what this must forbid.
        self.client.force_authenticate(user=self.customer)

        response = self.client.patch(self.url, {"status": Order.Status.CONFIRMED})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING)

    def test_staff_cannot_advance_an_order(self):
        self.client.force_authenticate(user=StaffUserFactory())

        response = self.client.patch(self.url, {"status": Order.Status.CONFIRMED})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING)

    def test_an_admin_can_advance_an_order_one_stage(self):
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.patch(self.url, {"status": Order.Status.CONFIRMED})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.CONFIRMED)
        self.assertTrue(self.order.events.filter(to_status=Order.Status.CONFIRMED).exists())

    def test_an_illegal_transition_is_rejected(self):
        # Pending -> Delivered skips the whole fulfilment chain.
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.patch(self.url, {"status": Order.Status.DELIVERED})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING)

    def test_an_order_can_be_cancelled_from_pending(self):
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.patch(self.url, {"status": Order.Status.CANCELLED})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.CANCELLED)

    def test_admin_cancel_returns_held_slots(self):
        car = CarModelFactory(slots_remaining=3)
        item = OrderItemFactory(order=self.order, car=car, quantity=1)
        car.slots_remaining = 2
        car.save(update_fields=["slots_remaining"])
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.patch(self.url, {"status": Order.Status.CANCELLED})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item.car.refresh_from_db()
        self.assertEqual(item.car.slots_remaining, 3)

    def test_a_delivered_order_is_terminal(self):
        self.order.status = Order.Status.DELIVERED
        self.order.save(update_fields=["status"])
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.patch(self.url, {"status": Order.Status.CANCELLED})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_customer_still_sees_the_updated_status_on_their_order(self):
        self.order.status = Order.Status.IN_PRODUCTION
        self.order.save(update_fields=["status"])
        self.client.force_authenticate(user=self.customer)

        detail = reverse("orders:order-detail", kwargs={"pk": self.order.pk})
        response = self.client.get(detail)

        self.assertEqual(response.data["status"], Order.Status.IN_PRODUCTION)
        self.assertEqual(response.data["status_display"], "In production")
        self.assertFalse(response.data["can_cancel"])


class HangarNoteTests(APITestCase):
    def setUp(self):
        self.order = OrderFactory()
        self.url = reverse("orders:order-add-note", kwargs={"pk": self.order.pk})

    def test_staff_can_leave_a_hangar_note(self):
        self.client.force_authenticate(user=StaffUserFactory())
        response = self.client.post(self.url, {"note": "Paint confirmed."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.order.events.filter(note="Paint confirmed.").exists())

    def test_a_customer_cannot_leave_a_hangar_note(self):
        self.client.force_authenticate(user=self.order.user)
        response = self.client.post(self.url, {"note": "please hurry"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

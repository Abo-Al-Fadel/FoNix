from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import AdminUserFactory, UserFactory
from cars.tests.factories import CarModelFactory
from orders.models import Order

from .factories import OrderFactory, OrderItemFactory


class OrderCreateAPITests(APITestCase):
    """POST /api/orders/ -- the checkout endpoint."""

    def setUp(self):
        self.url = reverse("orders:order-list")
        self.user = UserFactory()
        self.ignis = CarModelFactory(name="Ignis", base_price=Decimal("2400000.00"))
        self.aurea = CarModelFactory(name="Aurea", base_price=Decimal("890000.00"))

    def test_anonymous_users_cannot_place_an_order(self):
        response = self.client.post(
            self.url, {"items": [{"car": self.ignis.slug, "quantity": 1}]}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_authenticated_customer_can_place_an_order(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url,
            {
                "items": [
                    {"car": self.ignis.slug, "quantity": 1},
                    {"car": self.aurea.slug, "quantity": 2},
                ]
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get()
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.items.count(), 2)

    def test_the_response_is_the_full_order_not_the_cart_payload(self):
        """The confirmation screen needs an id and a total, not an echo of the
        request body -- that is what OrderCreateSerializer.to_representation
        is for."""
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, {"items": [{"car": self.ignis.slug, "quantity": 1}]}
        )

        self.assertIn("id", response.data)
        self.assertEqual(response.data["total"], "2400000.00")
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["items"][0]["car_name"], "Ignis")

    def test_a_client_supplied_price_is_ignored(self):
        """
        The most important test in the suite. If price_at_purchase were ever
        accepted from the request body, anyone could buy a hypercar for a pound.
        """
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url,
            {
                "items": [
                    {
                        "car": self.ignis.slug,
                        "quantity": 1,
                        "price_at_purchase": "1.00",
                    }
                ]
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Order.objects.get().items.first().price_at_purchase,
            Decimal("2400000.00"),
        )

    def test_a_client_cannot_place_an_order_on_someone_elses_account(self):
        victim = UserFactory()
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url,
            {"user": victim.id, "items": [{"car": self.ignis.slug, "quantity": 1}]},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.get().user, self.user)

    def test_an_empty_cart_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, {"items": []})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_unknown_car_slug_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, {"items": [{"car": "not-a-real-car", "quantity": 1}]}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_duplicated_car_gets_a_readable_400_not_a_database_error(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url,
            {
                "items": [
                    {"car": self.ignis.slug, "quantity": 1},
                    {"car": self.ignis.slug, "quantity": 1},
                ]
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_zero_quantity_is_rejected(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, {"items": [{"car": self.ignis.slug, "quantity": 0}]}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_absurd_quantity_is_rejected_before_it_reaches_the_database(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self.url, {"items": [{"car": self.ignis.slug, "quantity": 999999999}]}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_failed_order_leaves_nothing_behind(self):
        """
        Atomicity check. The first line is valid and the second is not, so the
        serializer rejects the whole request -- there must be no half-written
        order with one of its two cars.
        """
        self.client.force_authenticate(user=self.user)

        self.client.post(
            self.url,
            {
                "items": [
                    {"car": self.ignis.slug, "quantity": 1},
                    {"car": "not-a-real-car", "quantity": 1},
                ]
            },
        )

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

    def test_listing_orders_does_not_scale_its_query_count_with_the_order_count(self):
        """
        Order.total walks order.items, and each item renders its car's name --
        the textbook N+1. OrderQuerySet.with_items() collapses it to a fixed
        number of queries no matter how many orders come back.

        Four queries: the session/user lookup for authentication, the paginator
        COUNT, the orders page, and one prefetch for all items+cars.
        """
        for _ in range(5):
            order = OrderFactory(user=self.user)
            OrderItemFactory(order=order)
            OrderItemFactory(order=order)
        self.client.force_authenticate(user=self.user)

        with self.assertNumQueries(3):
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

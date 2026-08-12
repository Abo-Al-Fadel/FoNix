from decimal import Decimal

import factory

from accounts.tests.factories import UserFactory
from cars.tests.factories import CarModelFactory
from orders.models import Order, OrderItem


class OrderFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Order

    user = factory.SubFactory(UserFactory)


class OrderItemFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = OrderItem

    order = factory.SubFactory(OrderFactory)
    car = factory.SubFactory(CarModelFactory)
    quantity = 1
    # Set explicitly rather than copied from the car, so tests can create the
    # "car price changed after the sale" scenario that price_at_purchase exists
    # to handle.
    price_at_purchase = Decimal("250000.00")

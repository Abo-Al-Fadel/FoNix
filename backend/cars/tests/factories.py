from decimal import Decimal

import factory

from cars.models import CarImage, CarModel


class CarModelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CarModel

    name = factory.Sequence(lambda n: f"Test Model {n}")
    tagline = "A test car."
    description = "Specification copy used only by the test suite."
    base_price = Decimal("250000.00")
    range_km = 600
    top_speed_kmh = 330
    acceleration_0_100 = Decimal("2.50")

    # factory.django.ImageField generates a real (tiny) in-memory image via
    # Pillow. A plain string would not satisfy ImageField's validation, and
    # committing a fixture JPEG just to make tests pass would put a binary in
    # the repo for no reason.
    thumbnail = factory.django.ImageField(width=32, height=18, color="black")

    # slug is intentionally not declared: leaving it out exercises the model's
    # save() auto-slug path in every test that builds a car.


class CarImageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CarImage

    # SubFactory creates the parent car automatically, so a test that only
    # cares about images does not have to build one by hand. Pass car=<instance>
    # to attach images to a specific car instead.
    car = factory.SubFactory(CarModelFactory)
    image = factory.django.ImageField(width=32, height=18, color="black")
    alt_text = "A test car photographed in a dark studio."

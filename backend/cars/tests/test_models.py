from django.test import TestCase

from cars.models import CarImage, CarModel

from .factories import CarImageFactory, CarModelFactory


class CarModelTests(TestCase):
    def test_slug_is_generated_from_the_name(self):
        car = CarModelFactory(name="FoNix Ignis GT")

        self.assertEqual(car.slug, "fonix-ignis-gt")

    def test_an_explicit_slug_is_respected(self):
        car = CarModelFactory(name="FoNix Ignis", slug="custom-slug")

        self.assertEqual(car.slug, "custom-slug")

    def test_renaming_a_car_does_not_change_an_existing_slug(self):
        """
        Slugs are URLs. Regenerating one on rename would 404 every existing
        link, bookmark and search result pointing at the product page -- so
        save() only fills a slug that is empty.
        """
        car = CarModelFactory(name="FoNix Ignis")
        original_slug = car.slug

        car.name = "FoNix Ignis Mk II"
        car.save()

        self.assertEqual(car.slug, original_slug)

    def test_alt_text_falls_back_to_the_car_name(self):
        car = CarModelFactory(name="Ignis", thumbnail_alt="")

        self.assertEqual(car.alt_text, "The FoNix Ignis")

    def test_explicit_alt_text_wins(self):
        car = CarModelFactory(thumbnail_alt="A specific description.")

        self.assertEqual(car.alt_text, "A specific description.")

    def test_the_hero_car_is_ordered_first(self):
        CarModelFactory(name="Second")
        hero = CarModelFactory(name="First", is_hero=True)

        self.assertEqual(CarModel.objects.first(), hero)


class CarImageTests(TestCase):
    def test_deleting_a_car_deletes_its_gallery_images(self):
        """
        The CASCADE half of the on_delete story. A gallery image has no meaning
        without its car, so it should not survive as an orphan row.
        """
        car = CarModelFactory()
        CarImageFactory(car=car)
        CarImageFactory(car=car)

        car.delete()

        self.assertEqual(CarImage.objects.count(), 0)

    def test_images_are_ordered_by_display_order(self):
        car = CarModelFactory()
        third = CarImageFactory(car=car, display_order=3)
        first = CarImageFactory(car=car, display_order=1)

        self.assertEqual(list(car.images.all()), [first, third])

    def test_image_alt_text_falls_back_to_the_car_name(self):
        car = CarModelFactory(name="Ignis")
        image = CarImageFactory(car=car, alt_text="")

        self.assertEqual(image.resolved_alt_text, "The FoNix Ignis")

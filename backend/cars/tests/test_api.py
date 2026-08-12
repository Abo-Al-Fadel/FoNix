import io
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import AdminUserFactory, UserFactory
from cars.models import CarModel

from .factories import CarImageFactory, CarModelFactory


def tiny_image(name: str = "thumb.png") -> SimpleUploadedFile:
    """
    Build a real, valid PNG in memory for upload tests.

    ImageField validation opens the file with Pillow and rejects anything that
    is not a decodable image, so a SimpleUploadedFile wrapping b"not an image"
    would fail for the wrong reason -- and a committed fixture image would be a
    binary in the repo that nothing else needs.
    """
    buffer = io.BytesIO()
    Image.new("RGB", (16, 9), color="black").save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/png")


class CarListAPITests(APITestCase):
    """GET /api/cars/ -- must work for a logged-out visitor."""

    def setUp(self):
        self.url = reverse("cars:carmodel-list")

    def test_the_catalog_is_public(self):
        CarModelFactory()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_the_list_payload_carries_what_the_store_grid_renders(self):
        CarModelFactory(name="Ignis", base_price=Decimal("2400000.00"))

        car = self.client.get(self.url).data["results"][0]

        self.assertEqual(car["name"], "Ignis")
        self.assertEqual(car["base_price"], "2400000.00")
        self.assertIn("thumbnail", car)
        self.assertIn("thumbnail_alt", car)
        # The heavy fields belong to the detail endpoint only.
        self.assertNotIn("description", car)
        self.assertNotIn("images", car)

    def test_listing_cars_does_not_scale_its_query_count_with_the_catalog_size(self):
        """
        The N+1 regression test.

        Ten cars, each with two gallery images. If the list serializer ever
        starts touching car.images, this assertion fails loudly instead of the
        endpoint quietly getting slower with every car added to the catalog.

        Two queries: one COUNT for the paginator, one SELECT for the page.
        """
        for _ in range(10):
            car = CarModelFactory()
            CarImageFactory(car=car)
            CarImageFactory(car=car)

        with self.assertNumQueries(2):
            self.client.get(self.url)


class CarDetailAPITests(APITestCase):
    """GET /api/cars/{slug}/"""

    def setUp(self):
        self.car = CarModelFactory(name="Ignis")
        self.url = reverse("cars:carmodel-detail", kwargs={"slug": self.car.slug})

    def test_detail_is_public_and_looked_up_by_slug(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "ignis")

    def test_detail_includes_the_gallery(self):
        CarImageFactory(car=self.car, alt_text="Front three-quarter view.")

        response = self.client.get(self.url)

        self.assertEqual(len(response.data["images"]), 1)
        self.assertEqual(
            response.data["images"][0]["alt_text"], "Front three-quarter view."
        )

    def test_an_unknown_slug_is_a_404(self):
        url = reverse("cars:carmodel-detail", kwargs={"slug": "does-not-exist"})

        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_the_gallery_is_prefetched_rather_than_queried_per_image(self):
        """One query for the car, one for all of its images -- not one per image."""
        for _ in range(5):
            CarImageFactory(car=self.car)

        with self.assertNumQueries(2):
            self.client.get(self.url)


class CarWritePermissionTests(APITestCase):
    """
    The security-critical half of the catalog API.

    These are the tests that prove IsAdminOrReadOnly is actually enforced
    server-side, rather than the frontend merely hiding the buttons.
    """

    def setUp(self):
        self.list_url = reverse("cars:carmodel-list")
        self.car = CarModelFactory(name="Ignis")
        self.detail_url = reverse(
            "cars:carmodel-detail", kwargs={"slug": self.car.slug}
        )
        self.payload = {
            "name": "Aurea",
            "description": "A grand tourer.",
            "base_price": "890000.00",
            "range_km": 720,
            "top_speed_kmh": 310,
            "acceleration_0_100": "2.90",
        }

    def create_payload(self) -> dict:
        """
        A fresh payload including a thumbnail.

        The file object is consumed once it is read, so each request needs its
        own -- hence a method rather than a shared attribute on self.
        """
        return {**self.payload, "thumbnail": tiny_image()}

    # -- create ------------------------------------------------------------- #

    def test_anonymous_users_cannot_create_a_car(self):
        response = self.client.post(self.list_url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(CarModel.objects.count(), 1)

    def test_a_logged_in_customer_cannot_create_a_car(self):
        """
        403, not 401: the request is authenticated, it is simply not allowed.
        Returning 401 here would tell the frontend to bounce the user to the
        login page they just came from.
        """
        self.client.force_authenticate(user=UserFactory())

        response = self.client.post(self.list_url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(CarModel.objects.count(), 1)

    def test_an_admin_can_create_a_car(self):
        self.client.force_authenticate(user=AdminUserFactory())

        # multipart, not JSON: the payload carries an uploaded file, which JSON
        # cannot represent.
        response = self.client.post(
            self.list_url, self.create_payload(), format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Slug derived by the model, not supplied in the payload.
        self.assertTrue(CarModel.objects.filter(slug="aurea").exists())

    def test_a_car_cannot_be_created_without_a_thumbnail(self):
        """A car with no image would render as a hole in the store grid."""
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.post(self.list_url, self.payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("thumbnail", response.data)

    def test_a_superuser_can_create_a_car_even_with_the_customer_role(self):
        superuser = UserFactory(is_superuser=True, is_staff=True)
        self.client.force_authenticate(user=superuser)

        response = self.client.post(
            self.list_url, self.create_payload(), format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # -- update ------------------------------------------------------------- #

    def test_a_customer_cannot_edit_a_car(self):
        self.client.force_authenticate(user=UserFactory())

        response = self.client.patch(self.detail_url, {"base_price": "1.00"})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.car.refresh_from_db()
        self.assertNotEqual(self.car.base_price, Decimal("1.00"))

    def test_an_admin_can_edit_a_car(self):
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.patch(self.detail_url, {"base_price": "999999.00"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.car.refresh_from_db()
        self.assertEqual(self.car.base_price, Decimal("999999.00"))

    # -- delete ------------------------------------------------------------- #

    def test_a_customer_cannot_delete_a_car(self):
        self.client.force_authenticate(user=UserFactory())

        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(CarModel.objects.count(), 1)

    def test_an_admin_can_delete_a_car(self):
        self.client.force_authenticate(user=AdminUserFactory())

        response = self.client.delete(self.detail_url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(CarModel.objects.count(), 0)

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils.text import slugify


class CarModel(models.Model):
    """
    One model in the FoNix range (a product, not an individual vehicle).

    Named CarModel rather than Car because "Car" would read as a single
    physical car with a VIN. Allocations (`slots_remaining`) are the stock
    analogue: a hypercar is a build slot, not a crate of SKUs.
    """

    name = models.CharField(max_length=100)
    slug = models.SlugField(
        unique=True,
        blank=True,  # blank=True affects *forms* only; save() always fills it.
        help_text="URL identifier. Generated from the name if left blank.",
    )
    tagline = models.CharField(max_length=200, blank=True)
    description = models.TextField()

    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        # DecimalField, never FloatField, for money. A float cannot represent
        # 0.10 exactly, so float arithmetic on prices accumulates rounding error
        # -- an order total that is off by a penny is a real bug in a real shop.
        help_text="Base price in GBP.",
    )

    range_km = models.PositiveIntegerField(help_text="WLTP range in kilometres.")
    top_speed_kmh = models.PositiveIntegerField()
    acceleration_0_100 = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        help_text="0-100 km/h in seconds.",
    )

    thumbnail = models.ImageField(
        upload_to="cars/thumbnails/",
        help_text="Catalog card image. 16:9 works best with the store grid.",
    )
    thumbnail_alt = models.CharField(
        max_length=200,
        blank=True,
        # Alt text belongs to the content, not the template. Storing it lets
        # whoever uploads the image describe it, which is the only way alt text
        # is ever actually accurate (see the accessibility requirements).
        help_text="Alt text for the thumbnail. Falls back to the car name.",
    )

    is_hero = models.BooleanField(
        default=False,
        help_text="Marks the model featured in the homepage cinematic sequence.",
    )
    has_real_imagery = models.BooleanField(
        default=False,
        help_text=(
            "False for models whose photography has not been shot yet -- the "
            "store renders those with a stylised placeholder treatment and a "
            "'visualisation pending' badge rather than pretending otherwise."
        ),
    )

    is_published = models.BooleanField(
        default=True,
        help_text=(
            "Hidden from the public store when unticked. This is the soft-retire "
            "switch the order model asks for: a car referenced by a past order "
            "cannot be deleted (OrderItem.car is PROTECT), so it is hidden here "
            "instead. Staff still see hidden cars in the control panel."
        ),
    )

    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        # Internal build cost, used only to compute margin in the owner's
        # dashboard. Never placed on a public serializer -- exposing what a car
        # costs to build would be a commercial leak.
        help_text="Internal build cost in GBP. Never exposed publicly; drives profit figures.",
    )

    power_kw = models.PositiveIntegerField(null=True, blank=True)
    torque_nm = models.PositiveIntegerField(null=True, blank=True)
    weight_kg = models.PositiveIntegerField(null=True, blank=True)
    battery_kwh = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    charge_10_80_min = models.PositiveIntegerField(
        null=True, blank=True, help_text="DC 10–80% minutes."
    )
    ac_kw = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    length_mm = models.PositiveIntegerField(null=True, blank=True)
    width_mm = models.PositiveIntegerField(null=True, blank=True)
    height_mm = models.PositiveIntegerField(null=True, blank=True)
    seats = models.PositiveSmallIntegerField(default=2)
    drivetrain = models.CharField(max_length=40, blank=True)
    motor_count = models.PositiveSmallIntegerField(default=1)
    body_style = models.CharField(max_length=40, blank=True)
    warranty_years = models.PositiveSmallIntegerField(default=4)
    service_interval = models.CharField(max_length=80, blank=True)
    country_of_build = models.CharField(max_length=40, default="United Kingdom")
    homologation = models.CharField(max_length=80, blank=True)

    allocation_open = models.BooleanField(
        default=True,
        help_text="When false, the store shows a waitlist instead of Add to cart.",
    )
    slots_remaining = models.PositiveIntegerField(
        default=12,
        help_text="Build slots still available. Held when an order is placed, returned if it is cancelled before delivery.",
    )
    lead_time_weeks = models.PositiveSmallIntegerField(default=16)
    max_order_quantity = models.PositiveSmallIntegerField(
        default=1,
        help_text="An allocation is one car. Raising this is a deliberate choice.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Default ordering so paginated list responses are stable. Without it,
        # Postgres may return rows in any order and page 2 can repeat a row from
        # page 1 -- Django raises an UnorderedObjectListWarning for exactly this.
        # Hero model first, then newest.
        ordering = ("-is_hero", "-created_at")
        verbose_name = "car model"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        # Auto-slug on first save only. Regenerating the slug when the name is
        # edited would silently break every existing link and bookmark to the
        # product page, so an established slug is left alone deliberately.
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def alt_text(self) -> str:
        """Never return an empty alt string for a meaningful image."""
        return self.thumbnail_alt or f"The FoNix {self.name}"


class CarImage(models.Model):
    """A gallery still for a car model."""

    car = models.ForeignKey(
        CarModel,
        related_name="images",  # lets us write car.images.all()
        # CASCADE is correct here, unlike on the order FKs: a gallery image has
        # no meaning once its car is gone, and nothing else references it.
        # Deleting the car should take its photos with it rather than leaving
        # orphaned rows pointing at a missing parent.
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to="cars/gallery/")
    alt_text = models.CharField(max_length=200, blank=True)
    display_order = models.PositiveSmallIntegerField(
        default=0,
        help_text="Lower numbers appear first in the gallery.",
    )

    class Meta:
        ordering = ("display_order", "id")

    def __str__(self) -> str:
        return f"{self.car.name} image #{self.pk}"

    @property
    def resolved_alt_text(self) -> str:
        return self.alt_text or f"The FoNix {self.car.name}"


class CarOption(models.Model):
    """Paint, interior or wheels that change the price of one model."""

    class Category(models.TextChoices):
        PAINT = "paint", "Paint"
        INTERIOR = "interior", "Interior"
        WHEELS = "wheels", "Wheels"

    car = models.ForeignKey(
        CarModel, related_name="options", on_delete=models.CASCADE
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    name = models.CharField(max_length=80)
    price_delta = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Added to base_price. Zero is the no-cost default finish.",
    )
    is_default = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("category", "sort_order", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("car", "category", "name"),
                name="caroption_unique_name_per_category",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.car.name} {self.category}: {self.name}"

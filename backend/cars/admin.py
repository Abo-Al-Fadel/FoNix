from django.contrib import admin

from .models import CarImage, CarModel, CarOption


class CarImageInline(admin.TabularInline):
    """
    Edit gallery images on the car's own admin page.

    Without an inline, adding four photos to a car means four trips through a
    separate CarImage form, each one re-selecting the parent car from a
    dropdown. The inline is what makes the admin usable enough to populate the
    catalog before any frontend exists (build phase 3).
    """

    model = CarImage
    extra = 1
    fields = ("image", "alt_text", "display_order")


class CarOptionInline(admin.TabularInline):
    model = CarOption
    extra = 1
    fields = ("category", "name", "price_delta", "is_default", "sort_order")


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    inlines = [CarImageInline, CarOptionInline]

    list_display = (
        "name",
        "slug",
        "base_price",
        "body_style",
        "slots_remaining",
        "allocation_open",
        "is_hero",
        "is_published",
    )
    list_filter = ("is_hero", "has_real_imagery", "is_published", "body_style", "allocation_open")
    search_fields = ("name", "tagline", "description")
    prepopulated_fields = {"slug": ("name",)}

    fieldsets = (
        (None, {"fields": ("name", "slug", "tagline", "description")}),
        ("Pricing", {"fields": ("base_price", "cost")}),
        (
            "Performance",
            {
                "fields": (
                    "range_km",
                    "top_speed_kmh",
                    "acceleration_0_100",
                    "power_kw",
                    "torque_nm",
                    "weight_kg",
                    "battery_kwh",
                    "charge_10_80_min",
                    "ac_kw",
                )
            },
        ),
        (
            "Dimensions",
            {
                "fields": (
                    "length_mm",
                    "width_mm",
                    "height_mm",
                    "seats",
                    "drivetrain",
                    "motor_count",
                    "body_style",
                )
            },
        ),
        (
            "Trust",
            {
                "fields": (
                    "warranty_years",
                    "service_interval",
                    "country_of_build",
                    "homologation",
                )
            },
        ),
        (
            "Allocation",
            {
                "fields": (
                    "allocation_open",
                    "slots_remaining",
                    "lead_time_weeks",
                    "max_order_quantity",
                )
            },
        ),
        ("Imagery", {"fields": ("thumbnail", "thumbnail_alt", "has_real_imagery")}),
        ("Visibility", {"fields": ("is_hero", "is_published")}),
    )


@admin.register(CarImage)
class CarImageAdmin(admin.ModelAdmin):
    """
    Also registered standalone -- useful for bulk-reordering or auditing images
    across the whole catalog, which the inline can't do.
    """

    list_display = ("__str__", "car", "display_order")
    list_filter = ("car",)
    # A plain ForeignKey renders as a <select> containing every car. Fine at
    # four models; list_select_related keeps the changelist itself from doing an
    # extra query per row to render car.name.
    list_select_related = ("car",)

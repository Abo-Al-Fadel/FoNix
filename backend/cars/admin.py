from django.contrib import admin

from .models import CarImage, CarModel


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


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    inlines = [CarImageInline]

    list_display = (
        "name",
        "slug",
        "base_price",
        "range_km",
        "top_speed_kmh",
        "is_hero",
        "has_real_imagery",
        "is_published",
    )
    list_filter = ("is_hero", "has_real_imagery", "is_published")
    search_fields = ("name", "tagline", "description")

    # Live-fills the slug from the name as you type, so the admin behaves the
    # same way the model's save() does and there is no surprise when it is left
    # blank.
    prepopulated_fields = {"slug": ("name",)}

    fieldsets = (
        (None, {"fields": ("name", "slug", "tagline", "description")}),
        ("Pricing", {"fields": ("base_price", "cost")}),
        (
            "Performance",
            {"fields": ("range_km", "top_speed_kmh", "acceleration_0_100")},
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

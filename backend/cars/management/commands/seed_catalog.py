"""
Populates the FoNix catalog.

Run once after migrating:

    python manage.py seed_catalog

A management command rather than a data migration or a fixture JSON, because it
copies real image files out of the asset package and into MEDIA_ROOT. Migrations
should not depend on files that live outside the repo, and a fixture cannot
attach an image at all.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cars.models import CarImage, CarModel

from ._placeholder_art import render_placeholder

# The asset package sits alongside the backend and frontend directories, and is
# not part of either codebase -- it is source material.
DEFAULT_ASSET_DIR = Path(settings.BASE_DIR).parent / "fonix_assest"

# Which frames of the 215-frame orbit sequence become the flagship's product
# stills. They are all genuinely different views of the same car, which is
# exactly what a product gallery should be.
FLAGSHIP_STILLS = [
    ("frame_001.webp", "The FoNix Ignis head-on, headlights lit, in a dark studio."),
    (
        "frame_060.webp",
        "The FoNix Ignis in three-quarter profile, lit along its flank.",
    ),
    ("frame_120.webp", "The FoNix Ignis in profile with its dihedral door raised."),
    ("frame_190.webp", "The FoNix Ignis cabin, seen through the open door."),
]

# The thumbnail is the three-quarter view -- the most legible shape at card size.
FLAGSHIP_THUMBNAIL = "frame_060.webp"


CATALOG = [
    {
        "name": "FoNix Ignis",
        "slug": "ignis",
        "tagline": "The future, ignited.",
        "description": (
            "The Ignis is the car every other FoNix is measured against. Four "
            "independent motors, one at each wheel, deliver torque a thousand "
            "times a second through a carbon monocoque that weighs less than "
            "the driver it protects.\n\n"
            "There is no engine note to fake and no gearbox to wait for. Press "
            "the pedal and the horizon simply arrives. The dihedral doors, the "
            "single unbroken light blade along the flank, the cabin machined "
            "from one billet of aluminium — none of it is decoration. Each "
            "of them started as an aerodynamic or structural argument that the "
            "design team won."
        ),
        "base_price": Decimal("2400000.00"),
        "range_km": 640,
        "top_speed_kmh": 412,
        "acceleration_0_100": Decimal("2.10"),
        "is_hero": True,
        "has_real_imagery": True,
    },
    {
        "name": "FoNix Aurea",
        "slug": "aurea",
        "tagline": "Continents, compressed.",
        "description": (
            "A grand tourer built around a single question: how far can you go "
            "before the car asks you to stop? The Aurea answers with 780 "
            "kilometres, a cabin quiet enough to hold a conversation at 250 km/h, "
            "and a suspension that reads the road eight metres ahead.\n\n"
            "It is the softest car FoNix makes, and the one the engineers "
            "quietly take home at weekends."
        ),
        "base_price": Decimal("890000.00"),
        "range_km": 780,
        "top_speed_kmh": 330,
        "acceleration_0_100": Decimal("2.90"),
        "is_hero": False,
        "has_real_imagery": False,
        "art": {"scale": 0.58, "centre_x": 0.46, "glow": 0.55},
    },
    {
        "name": "FoNix Cinder",
        "slug": "cinder",
        "tagline": "Built for the lap, not the drive.",
        "description": (
            "Everything the Ignis carries for comfort has been removed, and what "
            "remains has been made stiffer. Fixed-back seats, a rear wing that "
            "generates 900kg of downforce, and a battery pack cooled hard enough "
            "to hold full power for an entire race distance rather than a single "
            "flying lap.\n\n"
            "Road-legal, in the same sense that a scalpel is technically cutlery."
        ),
        "base_price": Decimal("1350000.00"),
        "range_km": 480,
        "top_speed_kmh": 380,
        "acceleration_0_100": Decimal("2.30"),
        "is_hero": False,
        "has_real_imagery": False,
        "art": {"scale": 0.74, "centre_x": 0.56, "centre_y": 0.44, "glow": 0.35},
    },
    {
        "name": "FoNix Vesper",
        "slug": "vesper",
        "tagline": "Arrive before you are expected.",
        "description": (
            "Four doors, four seats, and the longest range in the FoNix range. "
            "The Vesper is the car for the people who buy the Ignis and then "
            "need to get to the airport.\n\n"
            "Rear-hinged back doors open to a cabin with no transmission tunnel "
            "and no compromise in it. The exterior gives almost nothing away, "
            "which is the entire point."
        ),
        "base_price": Decimal("420000.00"),
        "range_km": 820,
        "top_speed_kmh": 290,
        "acceleration_0_100": Decimal("3.40"),
        "is_hero": False,
        "has_real_imagery": False,
        "art": {"scale": 0.5, "centre_x": 0.5, "centre_y": 0.52, "glow": 0.62},
    },
]


class Command(BaseCommand):
    help = "Creates the FoNix catalog and attaches imagery from the asset package."

    def add_arguments(self, parser):
        parser.add_argument(
            "--assets",
            type=Path,
            default=DEFAULT_ASSET_DIR,
            help=f"Path to the asset package. Defaults to {DEFAULT_ASSET_DIR}",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing cars first. Refuses if any car has been ordered.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        assets: Path = options["assets"]
        frames = assets / "scroll"

        if not frames.is_dir():
            raise CommandError(
                f"Could not find the frame sequence at {frames}. "
                "Pass --assets /path/to/fonix_assest."
            )

        if options["reset"]:
            self._reset()

        for entry in CATALOG:
            self._seed_car(entry, frames)

        self.stdout.write(
            self.style.SUCCESS(f"Catalog ready: {CarModel.objects.count()} models.")
        )

    def _reset(self):
        """
        Clear the catalog before reseeding.

        OrderItem.car is PROTECT, so this raises rather than destroying the
        line items of a real order -- which is precisely the safety net that FK
        was chosen for. The error is left to surface as-is; silently skipping
        the protected car would leave a half-reset catalog.
        """
        deleted, _ = CarModel.objects.all().delete()
        self.stdout.write(f"Removed {deleted} existing catalog rows.")

    def _seed_car(self, entry: dict, frames: Path):
        data = {k: v for k, v in entry.items() if k != "art"}
        slug = data.pop("slug")

        # update_or_create makes the command idempotent: running it twice
        # refreshes the copy and pricing instead of raising a unique-constraint
        # error on the slug.
        car, created = CarModel.objects.update_or_create(slug=slug, defaults=data)

        # Images are replaced wholesale on a reseed so repeated runs don't
        # accumulate duplicate gallery rows.
        car.images.all().delete()

        if entry["has_real_imagery"]:
            self._attach_real_imagery(car, frames)
        else:
            self._attach_placeholder_art(car, entry.get("art", {}))

        verb = "Created" if created else "Updated"
        self.stdout.write(f"  {verb} {car.name} ({car.images.count()} gallery images)")

    def _attach_real_imagery(self, car: CarModel, frames: Path):
        thumbnail_path = frames / FLAGSHIP_THUMBNAIL
        if not thumbnail_path.exists():
            raise CommandError(f"Missing flagship thumbnail frame: {thumbnail_path}")

        # save=False then a single car.save(): one UPDATE instead of two.
        car.thumbnail.save(
            "ignis-thumbnail.webp",
            ContentFile(thumbnail_path.read_bytes()),
            save=False,
        )
        car.thumbnail_alt = (
            "The FoNix Ignis in three-quarter profile, lit against a dark studio floor."
        )
        car.save()

        for order, (filename, alt_text) in enumerate(FLAGSHIP_STILLS):
            source = frames / filename
            if not source.exists():
                raise CommandError(f"Missing flagship still: {source}")

            image = CarImage(car=car, alt_text=alt_text, display_order=order)
            image.image.save(
                f"ignis-{order + 1:02d}.webp",
                ContentFile(source.read_bytes()),
                save=False,
            )
            image.save()

    def _attach_placeholder_art(self, car: CarModel, art: dict):
        """
        Models without photography get generated artwork rather than a reused
        photo of a different car. See _placeholder_art.py for the reasoning.
        """
        car.thumbnail.save(
            f"{car.slug}-placeholder.png",
            ContentFile(render_placeholder(**art)),
            save=False,
        )
        car.thumbnail_alt = (
            f"Stylised placeholder artwork for the {car.name}. "
            "Photography for this model has not been produced yet."
        )
        car.save()

        # A single wider gallery variant, so the product page's gallery is not
        # empty while still being honestly a placeholder.
        image = CarImage(
            car=car,
            alt_text=car.thumbnail_alt,
            display_order=0,
        )
        # A second, tighter crop so the gallery is not simply the thumbnail
        # shown twice.
        image.image.save(
            f"{car.slug}-placeholder-wide.png",
            ContentFile(
                render_placeholder(
                    **{**art, "scale": art.get("scale", 0.62) * 1.35, "glow": 0.7}
                )
            ),
            save=False,
        )
        image.save()

"""
Populates the FoNix catalog.

Run once after migrating:

    python manage.py seed_catalog

A management command rather than a data migration or a fixture JSON, because it
copies real image files into MEDIA_ROOT. Migrations should not depend on image
files, and a fixture cannot attach one at all.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cars.models import CarImage, CarModel, CarOption

from ._placeholder_art import render_placeholder

# The flagship's stills are pulled from the very same 215-frame sequence the
# homepage hero scrubs through, which lives (committed) in the frontend's public
# folder. Reading from there rather than a separate source copy means there is
# ONE canonical set of frames in the repo, not two that can drift apart.
DEFAULT_ASSET_DIR = Path(settings.BASE_DIR).parent / "frontend" / "public" / "frames"

# The five non-flagship models have real (generated) studio photography, one
# optimised WebP hero + one gallery shot each, committed under the frontend's
# public folder. Same "one canonical home" principle as the frames above.
PRODUCT_DIR = Path(settings.BASE_DIR).parent / "frontend" / "public" / "product"

# Which frames of the 215-frame orbit sequence become the flagship's product
# stills. They are all genuinely different views of the same car, which is
# exactly what a product gallery should be.
FLAGSHIP_STILLS = [
    (
        "frame_040.webp",
        "The FoNix Ignis in a front three-quarter view, both headlights lit, "
        "reflected on a wet studio floor.",
    ),
    ("frame_001.webp", "The FoNix Ignis head-on, headlights lit, in a dark studio."),
    ("frame_120.webp", "The FoNix Ignis in profile with its dihedral door raised."),
    ("frame_190.webp", "The FoNix Ignis cabin, seen through the open door."),
]

# The thumbnail is the front three-quarter hero view -- the most flattering and
# legible shape at card size.
FLAGSHIP_THUMBNAIL = "frame_040.webp"


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
            "from one billet of aluminium - none of it is decoration. Each "
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
        "has_real_imagery": True,
        "photos": {
            "thumbnail_alt": "The FoNix Aurea grand tourer in champagne-graphite, front three-quarter view in a dark studio.",
            "gallery_alt": "The FoNix Aurea seen along its long grand-touring flank.",
        },
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
        "has_real_imagery": True,
        "photos": {
            "thumbnail_alt": "The FoNix Cinder track car in matte black with a fixed carbon rear wing, front three-quarter view.",
            "gallery_alt": "The FoNix Cinder from the rear three-quarter, showing its carbon wing and diffuser.",
        },
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
        "has_real_imagery": True,
        "photos": {
            "thumbnail_alt": "The FoNix Vesper four-door electric saloon, front three-quarter view in a dark studio.",
            "gallery_alt": "The FoNix Vesper in profile, showing all four doors and its long saloon roofline.",
        },
    },
    {
        "name": "FoNix Lumen",
        "slug": "lumen",
        "tagline": "The quiet one.",
        "description": (
            "The entry point to the marque, and the hardest car we have built. "
            "Anyone can make a fast car expensive; making a fast car cheap "
            "enough to sell and still worth the badge took four years.\n\n"
            "A single rear motor, a 74kWh pack, and a kerb weight under 1,500kg "
            "because the cheapest way to add performance is still to remove "
            "mass. It will out-corner most things costing three times as much, "
            "and it will do it without telling anybody."
        ),
        "base_price": Decimal("148000.00"),
        "range_km": 540,
        "top_speed_kmh": 250,
        "acceleration_0_100": Decimal("4.10"),
        "is_hero": False,
        "has_real_imagery": True,
        "photos": {
            "thumbnail_alt": "The FoNix Lumen compact electric coupe in gunmetal grey, front three-quarter view.",
            "gallery_alt": "The FoNix Lumen in profile, showing its compact lightweight proportions.",
        },
    },
    {
        "name": "FoNix Atlas",
        "slug": "atlas",
        "tagline": "For the roads that stopped being roads.",
        "description": (
            "A raised, long-travel FoNix with 280mm of ground clearance and a "
            "motor at each corner. Not a soft-roader with a body kit - the "
            "battery floor is a structural skid plate, and the suspension was "
            "signed off in Iceland rather than on a ring road.\n\n"
            "It carries five people and their luggage 700 kilometres, then "
            "climbs something that would stop a van. The two facts are not in "
            "tension; they are the same engineering."
        ),
        "base_price": Decimal("310000.00"),
        "range_km": 700,
        "top_speed_kmh": 230,
        "acceleration_0_100": Decimal("3.80"),
        "is_hero": False,
        "has_real_imagery": True,
        "photos": {
            "thumbnail_alt": "The FoNix Atlas raised electric SUV on chunky off-road tyres, front three-quarter view.",
            "gallery_alt": "The FoNix Atlas from the side, showing its ground clearance and rugged stance.",
        },
    },
]


SPECS = {
    "ignis": {
        "power_kw": 1847,
        "torque_nm": 3200,
        "weight_kg": 1420,
        "battery_kwh": Decimal("112.0"),
        "charge_10_80_min": 18,
        "ac_kw": Decimal("22.0"),
        "length_mm": 4580,
        "width_mm": 1988,
        "height_mm": 1142,
        "seats": 2,
        "drivetrain": "Quad-motor AWD",
        "motor_count": 4,
        "body_style": "coupe",
        "warranty_years": 4,
        "service_interval": "Every 20,000 km or 12 months",
        "country_of_build": "United Kingdom",
        "homologation": "UK / EU",
        "slots_remaining": 12,
        "lead_time_weeks": 18,
    },
    "aurea": {
        "power_kw": 680,
        "torque_nm": 980,
        "weight_kg": 1780,
        "battery_kwh": Decimal("126.0"),
        "charge_10_80_min": 22,
        "ac_kw": Decimal("22.0"),
        "length_mm": 4920,
        "width_mm": 1935,
        "height_mm": 1340,
        "seats": 4,
        "drivetrain": "Dual-motor AWD",
        "motor_count": 2,
        "body_style": "gt",
        "warranty_years": 5,
        "service_interval": "Every 25,000 km or 12 months",
        "country_of_build": "United Kingdom",
        "homologation": "UK / EU",
        "slots_remaining": 28,
        "lead_time_weeks": 22,
    },
    "cinder": {
        "power_kw": 1100,
        "torque_nm": 1450,
        "weight_kg": 1310,
        "battery_kwh": Decimal("82.0"),
        "charge_10_80_min": 16,
        "ac_kw": Decimal("11.0"),
        "length_mm": 4510,
        "width_mm": 2010,
        "height_mm": 1128,
        "seats": 2,
        "drivetrain": "Quad-motor AWD",
        "motor_count": 4,
        "body_style": "track",
        "warranty_years": 3,
        "service_interval": "Every 10,000 km or after a race weekend",
        "country_of_build": "United Kingdom",
        "homologation": "UK / EU track-day",
        "slots_remaining": 8,
        "lead_time_weeks": 26,
    },
    "vesper": {
        "power_kw": 510,
        "torque_nm": 720,
        "weight_kg": 1960,
        "battery_kwh": Decimal("118.0"),
        "charge_10_80_min": 24,
        "ac_kw": Decimal("22.0"),
        "length_mm": 5010,
        "width_mm": 1910,
        "height_mm": 1448,
        "seats": 4,
        "drivetrain": "Dual-motor AWD",
        "motor_count": 2,
        "body_style": "saloon",
        "warranty_years": 5,
        "service_interval": "Every 25,000 km or 12 months",
        "country_of_build": "United Kingdom",
        "homologation": "UK / EU",
        "slots_remaining": 40,
        "lead_time_weeks": 14,
    },
    "lumen": {
        "power_kw": 310,
        "torque_nm": 450,
        "weight_kg": 1485,
        "battery_kwh": Decimal("74.0"),
        "charge_10_80_min": 26,
        "ac_kw": Decimal("11.0"),
        "length_mm": 4280,
        "width_mm": 1860,
        "height_mm": 1295,
        "seats": 2,
        "drivetrain": "Rear-motor RWD",
        "motor_count": 1,
        "body_style": "coupe",
        "warranty_years": 4,
        "service_interval": "Every 20,000 km or 12 months",
        "country_of_build": "United Kingdom",
        "homologation": "UK / EU",
        "slots_remaining": 60,
        "lead_time_weeks": 10,
    },
    "atlas": {
        "power_kw": 620,
        "torque_nm": 1100,
        "weight_kg": 2240,
        "battery_kwh": Decimal("130.0"),
        "charge_10_80_min": 28,
        "ac_kw": Decimal("22.0"),
        "length_mm": 4985,
        "width_mm": 2040,
        "height_mm": 1720,
        "seats": 5,
        "drivetrain": "Quad-motor AWD",
        "motor_count": 4,
        "body_style": "suv",
        "warranty_years": 5,
        "service_interval": "Every 20,000 km or 12 months",
        "country_of_build": "United Kingdom",
        "homologation": "UK / EU",
        "slots_remaining": 24,
        "lead_time_weeks": 16,
    },
}

OPTIONS = [
    ("paint", "Obsidian", Decimal("0.00"), True, 0),
    ("paint", "Chalk", Decimal("4800.00"), False, 1),
    ("paint", "Ember", Decimal("12400.00"), False, 2),
    ("interior", "Black Alcantara", Decimal("0.00"), True, 0),
    ("interior", "Natural leather", Decimal("8600.00"), False, 1),
    ("wheels", "21-inch forged", Decimal("0.00"), True, 0),
    ("wheels", "Track aero", Decimal("6200.00"), False, 1),
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
        if not settings.DEBUG:
            raise CommandError(
                "seed_catalog is for local development only and must not run "
                "in production."
            )

        assets: Path = options["assets"]
        frames = assets / "scroll"

        if not frames.is_dir():
            raise CommandError(
                f"Could not find the frame sequence at {frames}. "
                "Pass --assets /path/to/frames-parent (the folder containing a "
                "'scroll' directory of frame_*.webp)."
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
        # `art` and `photos` are seeding instructions, not model fields, so they
        # are stripped before building the CarModel.
        data = {k: v for k, v in entry.items() if k not in ("art", "photos")}
        slug = data.pop("slug")
        data.update(SPECS.get(slug, {}))
        data.setdefault("allocation_open", True)
        data.setdefault("max_order_quantity", 1)

        # update_or_create makes the command idempotent: running it twice
        # refreshes the copy and pricing instead of raising a unique-constraint
        # error on the slug.
        car, created = CarModel.objects.update_or_create(slug=slug, defaults=data)

        # Images are replaced wholesale on a reseed so repeated runs don't
        # accumulate duplicate gallery rows.
        car.images.all().delete()

        # Three imagery paths: the flagship uses stills pulled from the hero
        # frame sequence; the other five now have real generated photography;
        # anything still flagged False would fall back to placeholder art.
        if slug == "ignis":
            self._attach_flagship_frames(car, frames)
        elif entry["has_real_imagery"]:
            self._attach_photo_set(car, slug, entry["photos"])
        else:
            self._attach_placeholder_art(car, entry.get("art", {}))

        verb = "Created" if created else "Updated"
        self._seed_options(car)
        self.stdout.write(f"  {verb} {car.name} ({car.images.count()} gallery images)")

    def _seed_options(self, car: CarModel):
        car.options.all().delete()
        CarOption.objects.bulk_create(
            [
                CarOption(
                    car=car,
                    category=category,
                    name=name,
                    price_delta=delta,
                    is_default=is_default,
                    sort_order=sort_order,
                )
                for category, name, delta, is_default, sort_order in OPTIONS
            ]
        )

    def _attach_photo_set(self, car: CarModel, slug: str, photos: dict):
        """
        Attach a car's real studio photography: a hero (also the thumbnail) and
        one gallery shot, both optimised WebPs under frontend/public/product/.
        """
        car_dir = PRODUCT_DIR / slug
        hero = car_dir / "hero.webp"
        gallery = car_dir / "gallery-1.webp"

        if not hero.exists():
            raise CommandError(
                f"Missing hero image for {car.name}: {hero}. "
                "Run tools/process_product_images.py first."
            )

        car.thumbnail.save(
            f"{slug}-hero.webp", ContentFile(hero.read_bytes()), save=False
        )
        car.thumbnail_alt = photos["thumbnail_alt"]
        car.save()

        # The hero is also the first gallery image, so the product page opens on
        # the same shot the card showed, then the second angle follows.
        stills = [(hero, photos["thumbnail_alt"])]
        if gallery.exists():
            stills.append((gallery, photos["gallery_alt"]))

        for order, (path, alt_text) in enumerate(stills):
            image = CarImage(car=car, alt_text=alt_text, display_order=order)
            image.image.save(
                f"{slug}-{order + 1:02d}.webp",
                ContentFile(path.read_bytes()),
                save=False,
            )
            image.save()

    def _attach_flagship_frames(self, car: CarModel, frames: Path):
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

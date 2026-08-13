"""
Optimises the generated car and brand images for the web.

The raw generations are ~1.5 MB PNGs. Shipping those directly would bloat the
page and the repo, so this converts each one to a resized WebP (the same format
the hero frames use), typically an 8-10x size cut with no visible loss on these
dark studio renders.

Output goes to committed, canonical locations under frontend/public/ so both the
site and the Django seed command read from one place:

    frontend/public/product/<slug>/hero.webp      thumbnail + first gallery shot
    frontend/public/product/<slug>/gallery-1.webp second gallery shot
    frontend/public/brand/hangar.webp             About page
    frontend/public/brand/light-blade.webp        About page
    frontend/public/og-image.webp                 social share banner

Run from the repo root:
    backend_venv/Scripts/python tools/process_product_images.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "assets"
PRODUCT_OUT = REPO / "frontend" / "public" / "product"
BRAND_OUT = REPO / "frontend" / "public" / "brand"

# (slug, hero source, gallery source). The hero doubles as the thumbnail.
CARS = [
    ("aurea", "aurea/hero.png", "aurea/4d74528f-5b1e-492d-a7d0-701d8e783774.png"),
    ("cinder", "cinder/hero1.png", "cinder/f9cdc533-5d07-44f2-8a2c-03364136c6a3.png"),
    ("vesper", "vesper/hero2.png", "vesper/55b4fe5a-eb35-4d65-ba62-13d74846f0ee.png"),
    ("lumen", "lumen/hero3.png", "lumen/8b992f75-33e6-416b-b6ee-565f5b4b4e4e.png"),
    ("atlas", "atlas/hero4.png", "atlas/ChatGPT Image Aug 13, 2026, 03_23_03 PM.png"),
]


def save_webp(src: Path, dest: Path, width: int, quality: int = 82) -> None:
    """Resize to `width` (keeping aspect) and write an optimised WebP."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > width:
            height = round(im.height * width / im.width)
            im = im.resize((width, height), Image.LANCZOS)
        im.save(dest, format="WEBP", quality=quality, method=6)
    kb = dest.stat().st_size / 1024
    print(f"  {dest.relative_to(REPO)}  ({kb:.0f} KB)")


def main() -> None:
    print("Cars:")
    for slug, hero, gallery in CARS:
        save_webp(SRC / "product" / hero, PRODUCT_OUT / slug / "hero.webp", 1600)
        save_webp(
            SRC / "product" / gallery, PRODUCT_OUT / slug / "gallery-1.webp", 1600
        )

    print("Brand:")
    save_webp(SRC / "brand" / "hangar.png", BRAND_OUT / "hangar.webp", 1600)
    save_webp(SRC / "brand" / "light-blade.png", BRAND_OUT / "light-blade.webp", 1600)
    # The lit night facade of the FoNix showroom -- used as the About page hero.
    save_webp(SRC / "brand" / "Company.png", BRAND_OUT / "showroom.webp", 1600)

    # The social banner: wider format, a touch higher quality since it is a
    # first impression when the link is shared.
    banner = REPO / "frontend" / "public" / "banner.png"
    if banner.exists():
        save_webp(banner, REPO / "frontend" / "public" / "og-image.webp", 1200, 86)

    print("done")


if __name__ == "__main__":
    main()

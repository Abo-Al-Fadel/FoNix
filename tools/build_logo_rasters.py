"""
Rasterises the FoNix mark into the PNG icon sizes browsers still ask for.

favicon.svg covers modern browsers, but Safari and a few Android launchers
want a real bitmap -- so these are generated from the *same* traced polygon
coordinates as the SVG rather than being exported by hand from an image editor.
One source of truth for the geometry means the icons can never drift out of
sync with the vector.

Usage (from the repo root):

    backend_venv/Scripts/python tools/build_logo_rasters.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

# The traced mark. Identical to the paths in
# frontend/src/components/brand/FoNixMark.jsx and public/favicon.svg.
MARK_WIDTH, MARK_HEIGHT = 476, 393
BLADE_UPPER = [(190, 0), (148, 31), (30, 334), (227, 72), (388, 71), (476, 2)]
BLADE_LOWER = [(203, 131), (0, 393), (209, 201), (298, 201), (376, 132)]

FX_BLACK = (10, 10, 10, 255)
FX_EMBER = (232, 98, 61, 255)
FX_WHITE = (255, 255, 255, 255)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public"

# Supersampling factor. Pillow's polygon fill is hard-edged, so we draw large
# and downsample with LANCZOS to get antialiased edges -- the difference is very
# visible on the mark's needle-thin tails at 32px.
SUPERSAMPLE = 8


def render_mark(
    size: int,
    *,
    fill: tuple,
    background: tuple | None = None,
    corner_radius_ratio: float = 0.1875,
    padding_ratio: float = 0.14,
) -> Image.Image:
    """Render the mark centred in a square canvas of `size` pixels."""
    hi = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (hi, hi), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    if background is not None:
        radius = hi * corner_radius_ratio
        draw.rounded_rectangle([0, 0, hi - 1, hi - 1], radius=radius, fill=background)

    # Fit the mark's 476x393 box inside the padded square, preserving ratio.
    usable = hi * (1 - 2 * padding_ratio)
    scale = min(usable / MARK_WIDTH, usable / MARK_HEIGHT)
    offset_x = (hi - MARK_WIDTH * scale) / 2
    offset_y = (hi - MARK_HEIGHT * scale) / 2

    for blade in (BLADE_UPPER, BLADE_LOWER):
        draw.polygon(
            [(offset_x + x * scale, offset_y + y * scale) for x, y in blade],
            fill=fill,
        )

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = [
        # (filename, size, fill, background)
        # The bare white mark on transparent, no plate: the favicon should read
        # as just the logo on a browser tab of any colour.
        ("favicon-32.png", 32, FX_WHITE, None),
        ("favicon-192.png", 192, FX_WHITE, None),
        # Apple ignores transparency and composites the icon onto a WHITE
        # background, so a white-on-transparent mark would vanish. The home-screen
        # icon is the one place the dark plate has to stay baked in, or the logo
        # disappears entirely on iOS.
        ("apple-touch-icon.png", 180, FX_WHITE, FX_BLACK),
        # Flat reverse mark, for anywhere the brand needs the bare logo.
        ("logo/fonix-mark-reverse.png", 512, FX_WHITE, None),
    ]

    for filename, size, fill, background in targets:
        path = OUTPUT_DIR / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        render_mark(size, fill=fill, background=background).save(path)
        print(f"wrote {path.relative_to(OUTPUT_DIR.parent.parent)} ({size}px)")

    # A multi-resolution .ico for the handful of contexts (some Windows surfaces)
    # that still demand one. White mark, transparent ground.
    ico_path = OUTPUT_DIR / "favicon.ico"
    render_mark(256, fill=FX_WHITE, background=None).save(
        ico_path, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print(f"wrote {ico_path.relative_to(OUTPUT_DIR.parent.parent)} (multi-size)")


if __name__ == "__main__":
    main()

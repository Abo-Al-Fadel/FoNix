"""
Generates the stylised placeholder artwork used by catalog models that have no
photography yet.

Why generate art at all, rather than reusing the flagship's stills under a
different name? Because a browsing visitor would immediately notice the same
car appearing three times under three names -- it reads as a content bug and
undermines everything else on the page. And a plain grey box reads as broken.

So these are deliberately *non-photographic*: a dark studio gradient carrying an
oversized, low-contrast FoNix mark. Obviously a design placeholder rather than a
photograph of a car that does not exist. The store pairs them with a
"visualisation pending" badge so nothing is ambiguous.

The blade geometry is the real traced logo (see tools/build_logo_rasters.py),
not an approximation, so the placeholders sit inside the brand rather than
beside it.
"""

from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFilter

# Brand tokens, matching the design system in the build brief.
FX_BLACK = (10, 10, 10)
FX_GRAPHITE = (28, 28, 30)
FX_EMBER = (232, 98, 61)

# The traced FoNix mark, in its own 476x393 coordinate space.
MARK_WIDTH, MARK_HEIGHT = 476, 393
BLADE_UPPER = [(190, 0), (148, 31), (30, 334), (227, 72), (388, 71), (476, 2)]
BLADE_LOWER = [(203, 131), (0, 393), (209, 201), (298, 201), (376, 132)]


def _vertical_gradient(size: tuple[int, int], top: tuple, bottom: tuple) -> Image.Image:
    """A gradient drawn one row at a time -- Pillow has no native gradient."""
    width, height = size
    base = Image.new("RGB", size, top)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        blend = y / max(height - 1, 1)
        draw.line(
            [(0, y), (width, y)],
            fill=tuple(round(top[i] + (bottom[i] - top[i]) * blend) for i in range(3)),
        )
    return base


def _studio_glow(
    size: tuple[int, int], centre_x: float, intensity: float
) -> Image.Image:
    """
    The soft pool of light behind the subject in the real product stills.

    A white ellipse on black, heavily blurred -- the cheapest convincing
    imitation of a softbox, used here as a compositing mask.
    """
    width, height = size
    glow = Image.new("L", size, 0)
    ImageDraw.Draw(glow).ellipse(
        [
            width * (centre_x - 0.36),
            height * 0.14,
            width * (centre_x + 0.36),
            height * 0.86,
        ],
        fill=int(255 * intensity),
    )
    return glow.filter(ImageFilter.GaussianBlur(radius=width // 10))


def _placed_blades(
    size: tuple[int, int], *, scale: float, centre_x: float, centre_y: float
) -> list[list[tuple[float, float]]]:
    """Map the mark's own coordinate space onto the canvas."""
    width, height = size
    drawn_height = height * scale
    factor = drawn_height / MARK_HEIGHT
    offset_x = width * centre_x - (MARK_WIDTH * factor) / 2
    offset_y = height * centre_y - drawn_height / 2

    return [
        [(offset_x + x * factor, offset_y + y * factor) for x, y in blade]
        for blade in (BLADE_UPPER, BLADE_LOWER)
    ]


def render_placeholder(
    *,
    width: int = 1600,
    height: int = 900,
    scale: float = 0.62,
    centre_x: float = 0.5,
    centre_y: float = 0.48,
    glow: float = 0.5,
    accent: bool = True,
) -> bytes:
    """
    Render one placeholder and return PNG bytes, ready for a Django file field.

    The keyword arguments exist so each catalog model gets a visibly distinct
    composition -- four identical images would be as obviously wrong as four
    copies of the same photograph.
    """
    size = (width, height)

    canvas = _vertical_gradient(size, FX_GRAPHITE, FX_BLACK)
    canvas = Image.composite(
        _vertical_gradient(size, (44, 44, 48), (16, 16, 18)),
        canvas,
        _studio_glow(size, centre_x, glow),
    )

    blades = _placed_blades(size, scale=scale, centre_x=centre_x, centre_y=centre_y)

    # The mark is drawn as a *mask* over a slightly brighter gradient rather
    # than as flat fill, so it reads as a lit surface catching light from above
    # -- the same way the car does in the real stills.
    lit = _vertical_gradient(size, (74, 74, 80), (30, 30, 34))
    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    for blade in blades:
        mask_draw.polygon(blade, fill=255)
    # A slight blur softens Pillow's hard polygon edges into something that
    # survives being scaled down into a catalog card.
    canvas = Image.composite(lit, canvas, mask.filter(ImageFilter.GaussianBlur(1.4)))

    # One ember hairline, down the leading edge of the upper blade only.
    # Tracing every edge produced four bright strokes that read as scratches
    # across the image; a single half-strength line reads as a highlight -- and
    # "spend the accent in one place" is the design system's own rule.
    if accent:
        # A mask value of 115/255 composites the ember at roughly 45% strength,
        # so it sits as a highlight on the form rather than a line drawn over it.
        accent_mask = Image.new("L", size, 0)
        ImageDraw.Draw(accent_mask).line(
            [blades[0][0], blades[0][1], blades[0][2]], fill=115, width=2
        )
        canvas = Image.composite(Image.new("RGB", size, FX_EMBER), canvas, accent_mask)

    draw = ImageDraw.Draw(canvas)

    # A faint horizon grounds the composition the way the wet studio floor does.
    draw.line([(0, height * 0.8), (width, height * 0.8)], fill=(36, 36, 40), width=2)

    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()

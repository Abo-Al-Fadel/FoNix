"""
Builds the mobile frame set for the homepage scroll sequence.

The source sequence is 215 WebP stills at 1600x900 (~12MB). That is fine over
broadband and indefensible over mobile data, so this produces a second set with
two reductions applied together:

    frame count   215 -> 108      (every second frame)
    resolution    1600x900 -> 1200x675
    payload       ~12MB -> ~3MB

Either reduction alone leaves the set either too heavy or too soft. Together
they keep the actual scroll-scrub -- rather than degrading it to a cross-fade --
sharp enough for a high-DPR phone screen at a size mobile data can still
justify. An earlier pass used 800x450, which was light but visibly soft once a
modern phone scaled it up; 1200 wide is the point where it reads crisp.
See frontend/src/components/hero/frameSource.js for how the two sets are
selected at runtime.

Usage (from the repo root, after the source frames are in place):

    backend_venv/Scripts/python tools/build_mobile_frames.py
"""

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO_ROOT / "frontend" / "public" / "frames" / "scroll"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "frames" / "scroll-mobile"

# Keep every Nth frame.
FRAME_STRIDE = 2
# Target width in pixels; height follows the source aspect ratio. 1200 (from a
# 1600-wide source) stays crisp on a high-DPR phone where 800 looked soft.
TARGET_WIDTH = 1200
# WebP quality. 78 holds up under the upscaling a retina screen applies; the
# footage is mostly dark gradients, which compress well even at this level.
WEBP_QUALITY = 78


def main() -> None:
    if not SOURCE_DIR.is_dir():
        raise SystemExit(f"Source frames not found at {SOURCE_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sources = sorted(SOURCE_DIR.glob("frame_*.webp"))
    if not sources:
        raise SystemExit(f"No frame_*.webp files in {SOURCE_DIR}")

    kept = sources[::FRAME_STRIDE]
    total_bytes = 0

    for index, path in enumerate(kept, start=1):
        with Image.open(path) as image:
            image = image.convert("RGB")
            target_height = round(image.height * TARGET_WIDTH / image.width)
            image = image.resize(
                (TARGET_WIDTH, target_height),
                Image.LANCZOS,
            )
            # Renumbered from 1 so the mobile set is contiguous -- the frontend
            # can then index it identically to the desktop set, with only the
            # count differing.
            destination = OUTPUT_DIR / f"frame_{index:03d}.webp"
            image.save(destination, format="WEBP", quality=WEBP_QUALITY, method=5)
            total_bytes += destination.stat().st_size

    print(f"source frames : {len(sources)}")
    print(f"mobile frames : {len(kept)}")
    print(f"total payload : {total_bytes / 1_048_576:.2f} MB")
    print(f"per frame     : {total_bytes / len(kept) / 1024:.1f} KB")
    print()
    print(
        "Update MOBILE_FRAMES.count in "
        "frontend/src/components/hero/frameSource.js if the count changed."
    )


if __name__ == "__main__":
    main()

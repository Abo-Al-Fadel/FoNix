"""
Builds the mobile frame set for the homepage scroll sequence.

The source sequence is 215 WebP stills at 1600x900 (~12MB). That is fine over
broadband and indefensible over mobile data, so this produces a second set with
two reductions applied together:

    frame count   215 -> 108      (every second frame)
    resolution    1600x900 -> 800x450
    payload       ~12MB -> ~1.4MB

Either reduction alone leaves several megabytes. Together they keep the actual
scroll-scrub -- rather than degrading it to a cross-fade -- at a size a phone
can justify. See frontend/src/components/hero/frameSource.js for how the two
sets are selected at runtime.

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
# Divide both dimensions by this.
SCALE_DIVISOR = 2
# WebP quality. 72 is the point where artefacts stop being visible on this
# footage -- it is almost entirely dark gradients, which compress well.
WEBP_QUALITY = 72


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
            image = image.resize(
                (image.width // SCALE_DIVISOR, image.height // SCALE_DIVISOR),
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

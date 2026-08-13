/**
 * Describes which frame sequence to load, and how to load it.
 *
 * MOBILE STRATEGY (this was an open question in the build brief).
 *
 * The desktop sequence is 215 WebP stills at 1600x900, roughly 12MB. That is
 * defensible over a broadband connection for the one page the whole site is
 * built around. It is not defensible on a phone, on mobile data.
 *
 * The brief offered two options: a reduced frame subset, or replacing the
 * scrub entirely with a few cross-faded stills. This takes the first, but
 * pushes it further than "every other frame" -- because halving the frame
 * count alone still leaves ~6MB, and the frames are also being displayed on a
 * screen a third of the width.
 *
 * So the mobile set applies both reductions at once:
 *
 *   frame count   215 -> 108  (every second frame)
 *   resolution    1600x900 -> 1200x675
 *   ---------------------------------------------
 *   payload       ~12MB -> ~2.9MB  (27.7KB per frame)
 *
 * That keeps the actual scroll-scrub -- which is the thing worth showing --
 * rather than degrading it to a cross-fade, while cutting the download by ~76%.
 * 1200 wide (up from an earlier 800, which looked soft once a phone scaled it)
 * stays crisp on a high-DPR screen. 108 frames over the pinned scroll distance
 * is still ~1 frame per 12px of scroll, which reads as continuous motion.
 *
 * Regenerate the mobile set with:
 *   backend_venv/Scripts/python tools/build_mobile_frames.py
 */

export const DESKTOP_FRAMES = {
  count: 215,
  path: "/frames/scroll",
  width: 1600,
  height: 900,
};

export const MOBILE_FRAMES = {
  count: 108,
  path: "/frames/scroll-mobile",
  width: 1200,
  height: 675,
};

/** Frames are named frame_001.webp ... frame_215.webp (1-indexed). */
export function frameUrl(source, index) {
  const number = String(index + 1).padStart(3, "0");
  return `${source.path}/frame_${number}.webp`;
}

/**
 * Preload every frame into decoded Image objects.
 *
 * Two things make this workable rather than a stall:
 *
 * 1. It runs *during the 6-second intro video*. The user is watching something
 *    while the sequence downloads, so the cost is hidden behind time that was
 *    being spent anyway.
 * 2. `onProgress` fires as frames land, so the scroll hint can wait for enough
 *    of the sequence to be ready rather than for all of it.
 *
 * Returns { images, cancel }. `cancel` matters: navigating away mid-preload
 * should not leave 215 in-flight requests and their onload handlers pointing at
 * an unmounted component.
 */
export function preloadFrames(source, onProgress) {
  const images = new Array(source.count);
  let loaded = 0;
  let cancelled = false;

  for (let index = 0; index < source.count; index += 1) {
    const image = new Image();

    // Decoding off the main thread keeps the first draw from janking the
    // video that is still playing behind it.
    image.decoding = "async";

    const settle = () => {
      if (cancelled) return;
      loaded += 1;
      onProgress?.(loaded, source.count);
    };

    image.onload = settle;
    // A failed frame still counts as settled. One missing file must not leave
    // the sequence permanently "loading" -- the canvas simply keeps the
    // previous frame when it hits a gap.
    image.onerror = settle;

    image.src = frameUrl(source, index);
    images[index] = image;
  }

  return {
    images,
    cancel() {
      cancelled = true;
      // Dropping the handlers is what actually detaches this from the
      // component; the browser may still finish the requests, but nothing is
      // listening.
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    },
  };
}

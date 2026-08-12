/**
 * Captions timed to the scroll sequence.
 *
 * `from`/`to` are ScrollTrigger progress values (0 = sequence start, 1 = end),
 * so they stay correct whichever frame set is loaded -- the desktop 215 and the
 * mobile 108 both map onto the same 0..1 range.
 *
 * Ranges deliberately leave small gaps between them. A caption fades out before
 * the next fades in, so two never overlap mid-crossfade.
 */
export const SCENE_CAPTIONS = [
  {
    from: 0.04,
    to: 0.24,
    eyebrow: "Exterior",
    title: "One unbroken line",
    body: "The light blade runs from the front splitter to the rear diffuser without a single join. It is difficult to tool, expensive to align, and impossible to unsee.",
  },
  {
    from: 0.28,
    to: 0.46,
    eyebrow: "Aerodynamics",
    title: "Shaped by air, not by taste",
    body: "Every surface behind the front axle exists to keep airflow attached. The rear haunches are the width they are because 340 km/h decided it.",
  },
  {
    from: 0.5,
    to: 0.68,
    eyebrow: "Access",
    title: "Dihedral doors, electrically actuated",
    body: "Each door lifts on a single motorised strut in 1.2 seconds, clearing the sill entirely. There is no handle to pull — the car recognises the key and opens as you reach it.",
  },
  {
    from: 0.72,
    to: 0.97,
    eyebrow: "Cabin",
    title: "Machined from one billet",
    body: "The centre console is cut from a single piece of aluminium. No trim, no seams, no plastic pretending to be metal. The screen wakes when you sit down and sleeps when you leave.",
  },
];

/** The caption active at a given progress, or null between beats. */
export function captionAt(progress) {
  return (
    SCENE_CAPTIONS.find(
      (caption) => progress >= caption.from && progress <= caption.to,
    ) ?? null
  );
}

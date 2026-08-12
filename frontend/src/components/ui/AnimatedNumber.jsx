import { useEffect, useRef, useState } from "react";

import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion.js";

/**
 * A number that counts up when it scrolls into view.
 *
 * Two details do most of the work:
 *
 * 1. It eases OUT (fast at first, slowing to a stop) rather than running at a
 *    constant rate. A linear counter looks like a loading spinner; an eased one
 *    looks like an instrument needle settling.
 *
 * 2. It animates on requestAnimationFrame, not setInterval. rAF is synchronised
 *    to the display's refresh, so the digits change on frame boundaries instead
 *    of tearing between them.
 *
 * The element reserves its final width up front via `tabular-nums`, so the
 * layout does not jitter as digits change width mid-count.
 */
export default function AnimatedNumber({
  value,
  duration = 1600,
  decimals = 0,
  className = "",
  // Rendered after the number, inside the same element, so a screen reader
  // announces "412 km/h" as one phrase.
  suffix = "",
  prefix = "",
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const elementRef = useRef(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Someone who asked for less motion gets the final number immediately.
    // Counting is decorative; the value is the information.
    if (prefersReducedMotion) {
      setDisplay(value);
      return undefined;
    }

    const element = elementRef.current;
    if (!element) return undefined;

    let frameId = null;

    // IntersectionObserver rather than a scroll listener: the browser tells us
    // when the element enters the viewport instead of us asking on every
    // scroll event, which is both cheaper and simpler.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // hasRun guard: counting up again every time it scrolls back into view
        // would be a fidget, not a flourish.
        if (!entry.isIntersecting || hasRunRef.current) return;
        hasRunRef.current = true;

        const start = performance.now();

        const tick = (now) => {
          const elapsed = now - start;
          const linear = Math.min(elapsed / duration, 1);

          // easeOutExpo -- a hard launch that decelerates to nothing. The
          // conditional avoids the tiny floating-point overshoot at exactly 1.
          const eased = linear === 1 ? 1 : 1 - Math.pow(2, -10 * linear);

          setDisplay(value * eased);

          if (linear < 1) frameId = requestAnimationFrame(tick);
          else setDisplay(value); // land exactly, never on 411.9997
        };

        frameId = requestAnimationFrame(tick);
      },
      // Fire a little before the element is fully on screen, so the count is
      // already underway by the time it is comfortably in view.
      { threshold: 0.35, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [value, duration, prefersReducedMotion]);

  const formatted = display.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span
      ref={elementRef}
      // tabular-nums makes every digit the same width, so "1,847" does not
      // shift sideways as it counts through narrower digits like 1 and 7.
      className={`[font-variant-numeric:tabular-nums] ${className}`}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

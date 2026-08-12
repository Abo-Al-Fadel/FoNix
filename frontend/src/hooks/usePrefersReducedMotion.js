import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks the user's OS-level motion preference.
 *
 * Read once at mount *and* subscribed to, because the setting can change while
 * the page is open -- and a hero that keeps auto-playing after someone has
 * just switched reduced motion on is exactly the failure this is meant to
 * prevent. It is also how the preference can be toggled in devtools and
 * verified without a reload.
 */
export default function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Guarded for the initial render in any non-browser environment.
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(QUERY);
    const onChange = (event) => setPrefersReducedMotion(event.matches);

    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}

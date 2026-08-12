import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query from JavaScript.
 *
 * Used where a breakpoint has to change *behaviour*, not just styling -- the
 * hero picks a different frame set below 768px, and no amount of CSS can do
 * that. Anything purely visual should use a Tailwind responsive class instead;
 * this hook re-renders, and CSS does not.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(query);
    // Re-sync on mount: the query string could have changed between renders.
    setMatches(mediaQuery.matches);

    const onChange = (event) => setMatches(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

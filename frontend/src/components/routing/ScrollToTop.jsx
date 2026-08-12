import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll position on navigation.
 *
 * A browser restores scroll position on a real page load, but a client-side
 * route change is not one -- so without this, clicking a car from halfway down
 * the store lands you halfway down the product page. Renders nothing.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // "instant" rather than the smooth behaviour set globally in index.css:
    // smooth-scrolling the whole page on every navigation feels broken, and it
    // would fight the hero's pinned scroll section on the way back to home.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

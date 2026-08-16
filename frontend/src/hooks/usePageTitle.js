import { useEffect } from "react";

const DEFAULT_TITLE = "FoNix | Official Site";

/**
 * Sets document.title for as long as the calling page is mounted.
 *
 * Layout uses this with titleForPath() so every route has a title without
 * each page remembering to call it. ProductDetail overrides with the car name
 * once the catalog payload arrives.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title || DEFAULT_TITLE;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

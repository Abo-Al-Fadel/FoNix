import { useCallback, useEffect, useRef, useState } from "react";

import { extractErrorMessage } from "../api/client.js";

/**
 * Fetch-on-mount with loading, error and retry.
 *
 * A real app of any size would reach for TanStack Query here and get caching,
 * deduplication and background revalidation for free. At this scale -- a
 * handful of read-only endpoints -- a small hook is the honest choice: no
 * dependency, and nothing hidden from someone reading the code to learn from
 * it.
 *
 * `isLoading` is only true when there is nothing on screen yet. A retry or
 * an optimistic `setData` must not unmount the current UI and replace it
 * with the 45vh spinner -- that is the catalogue hide/unhide jump. Background
 * refetches set `isValidating` instead.
 *
 * @param {() => Promise<any>} fetcher - must be stable (useCallback at the
 *   call site), or the effect below will re-run on every render.
 */
export default function useApiResource(fetcher, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isValidating, setIsValidating] = useState(false);
  // Bumping this re-runs the effect, which is how retry works without
  // duplicating the fetch logic.
  const [attempt, setAttempt] = useState(0);
  const hasDataRef = useRef(false);
  const lastFetcherRef = useRef(fetcher);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setIsValidating(false);
      return undefined;
    }

    // A new fetcher is a different resource (e.g. /store/ignis → /store/aurea).
    // Drop the previous payload so we never render the wrong record under the
    // new URL, and treat it as an initial load rather than a background retry.
    if (lastFetcherRef.current !== fetcher) {
      lastFetcherRef.current = fetcher;
      hasDataRef.current = false;
      setData(null);
    }

    // Guards against a stale response overwriting a newer one: navigate from
    // /store/ignis to /store/aurea quickly and the first request may resolve
    // second. Without this flag, the page would show Aurea's URL and Ignis's
    // data.
    let cancelled = false;

    if (hasDataRef.current) {
      setIsValidating(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          hasDataRef.current = true;
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(extractErrorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsValidating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { data, setData, error, isLoading, isValidating, retry };
}

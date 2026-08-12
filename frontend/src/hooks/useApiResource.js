import { useCallback, useEffect, useState } from "react";

import { extractErrorMessage } from "../api/client.js";

/**
 * Fetch-on-mount with loading, error and retry.
 *
 * A real app of any size would reach for TanStack Query here and get caching,
 * deduplication and background revalidation for free. At this scale -- a
 * handful of read-only endpoints -- a 40-line hook is the honest choice: no
 * dependency, and nothing hidden from someone reading the code to learn from
 * it.
 *
 * @param {() => Promise<any>} fetcher - must be stable (useCallback at the
 *   call site), or the effect below will re-run on every render.
 */
export default function useApiResource(fetcher, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);
  // Bumping this re-runs the effect, which is how retry works without
  // duplicating the fetch logic.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    // Guards against a stale response overwriting a newer one: navigate from
    // /store/ignis to /store/aurea quickly and the first request may resolve
    // second. Without this flag, the page would show Aurea's URL and Ignis's
    // data.
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(extractErrorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, enabled, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { data, error, isLoading, retry };
}

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useApiResource from "./useApiResource.js";

describe("useApiResource", () => {
  it("keeps isLoading false on retry once data is on screen", async () => {
    const fetcher = vi.fn();
    fetcher.mockResolvedValueOnce(["ignis"]);
    fetcher.mockResolvedValueOnce(["ignis", "aurea"]);

    const { result } = renderHook(() => useApiResource(fetcher));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(["ignis"]);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(result.current.data).toEqual(["ignis", "aurea"]));
    expect(result.current.isValidating).toBe(false);
  });

  it("exposes setData so callers can patch without a refetch", async () => {
    const fetcher = vi.fn().mockResolvedValue([{ slug: "ignis", is_published: true }]);
    const { result } = renderHook(() => useApiResource(fetcher));

    await waitFor(() => expect(result.current.data).toHaveLength(1));

    act(() => {
      result.current.setData((list) =>
        list.map((row) => ({ ...row, is_published: false })),
      );
    });

    expect(result.current.data[0].is_published).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

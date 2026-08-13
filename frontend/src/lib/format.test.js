import { describe, expect, it } from "vitest";

import { formatDate, formatPrice, headlineSpecs } from "./format.js";

describe("formatPrice", () => {
  it("formats a decimal string as GBP with no pence", () => {
    // DRF sends DecimalField as a string; hypercar prices have no meaningful
    // pence, so the display drops them.
    expect(formatPrice("2400000.00")).toBe("£2,400,000");
  });

  it("accepts a number as well as a string", () => {
    expect(formatPrice(148000)).toBe("£148,000");
  });

  it("returns a dash for a non-numeric value rather than NaN", () => {
    expect(formatPrice("not a price")).toBe("-");
    expect(formatPrice(undefined)).toBe("-");
  });
});

describe("formatDate", () => {
  it("formats an ISO string as a readable UK date", () => {
    expect(formatDate("2026-08-13T10:00:00Z")).toBe("13 August 2026");
  });

  it("returns a dash for an invalid date", () => {
    expect(formatDate("nonsense")).toBe("-");
  });
});

describe("headlineSpecs", () => {
  it("returns the three headline specs in a fixed order", () => {
    const specs = headlineSpecs({
      range_km: 640,
      top_speed_kmh: 412,
      acceleration_0_100: "2.10",
    });

    expect(specs.map((s) => s.label)).toEqual(["Range", "Top speed", "0–100"]);
  });

  it("strips the trailing zero from acceleration", () => {
    // "2.10" from the API should read as "2.1" the way a spec sheet prints it.
    const specs = headlineSpecs({
      range_km: 1,
      top_speed_kmh: 1,
      acceleration_0_100: "2.10",
    });
    const accel = specs.find((s) => s.label === "0–100");
    expect(accel.value).toBe("2.1");
  });
});

import { describe, expect, it } from "vitest";

import { nextStatuses, statusLabel } from "./orderStatus.js";

describe("order status flow", () => {
  it("offers the legal next steps from each stage", () => {
    expect(nextStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextStatuses("in_transit")).toEqual(["delivered", "cancelled"]);
  });

  it("treats delivered and cancelled as terminal", () => {
    expect(nextStatuses("delivered")).toEqual([]);
    expect(nextStatuses("cancelled")).toEqual([]);
  });

  it("labels the multi-word statuses readably", () => {
    expect(statusLabel("in_production")).toBe("In production");
    expect(statusLabel("delivered")).toBe("Delivered");
  });
});

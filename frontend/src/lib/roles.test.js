import { describe, expect, it } from "vitest";

import { hasAtLeast, rankOf } from "./roles.js";

describe("role hierarchy", () => {
  it("ranks the four tiers in order", () => {
    expect(rankOf("customer")).toBe(0);
    expect(rankOf("staff")).toBe(1);
    expect(rankOf("admin")).toBe(2);
    expect(rankOf("owner")).toBe(3);
  });

  it("treats unknown or missing roles as customer", () => {
    expect(rankOf(undefined)).toBe(0);
    expect(rankOf("wizard")).toBe(0);
  });

  it("hasAtLeast is inclusive of the boundary", () => {
    expect(hasAtLeast("staff", "staff")).toBe(true);
    expect(hasAtLeast("admin", "staff")).toBe(true);
    expect(hasAtLeast("owner", "admin")).toBe(true);
  });

  it("hasAtLeast rejects roles below the minimum", () => {
    expect(hasAtLeast("customer", "staff")).toBe(false);
    expect(hasAtLeast("staff", "admin")).toBe(false);
    expect(hasAtLeast("admin", "owner")).toBe(false);
  });
});

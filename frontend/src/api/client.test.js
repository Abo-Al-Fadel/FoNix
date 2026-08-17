import { describe, expect, it } from "vitest";

import { extractErrorMessage } from "./client.js";

describe("extractErrorMessage", () => {
  it("reads a nested payment field instead of [object Object]", () => {
    const error = {
      response: {
        data: { payment: { number: ["Check the card number."] } },
      },
    };
    expect(extractErrorMessage(error)).toBe("Card number: Check the card number.");
  });

  it("reads a string detail", () => {
    const error = {
      response: { data: { detail: "The bank declined this card." } },
    };
    expect(extractErrorMessage(error)).toBe("The bank declined this card.");
  });

  it("reads a delivery phone error", () => {
    const error = {
      response: { data: { delivery: { phone: ["This field may not be blank."] } } },
    };
    expect(extractErrorMessage(error)).toBe("Phone: This field may not be blank.");
  });
});

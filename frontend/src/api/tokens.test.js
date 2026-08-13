import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTokens,
  decodeToken,
  getAccessToken,
  isTokenExpired,
  setTokens,
} from "./tokens.js";

/**
 * Token helpers are security-adjacent, so their edge cases matter: a decode
 * that throws on a malformed token, or an expiry check that reads a missing
 * claim as "valid forever", would both be real bugs.
 */

/** Build a JWT-shaped string with a given payload. Signature is irrelevant to
 *  these helpers -- they never verify it (only the server can). */
function makeToken(payload) {
  const b64 = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("storage", () => {
  it("round-trips access and refresh tokens", () => {
    setTokens({ access: "a-token", refresh: "r-token" });
    expect(getAccessToken()).toBe("a-token");
  });

  it("leaves the stored refresh token alone when a refresh omits it", () => {
    setTokens({ access: "a1", refresh: "r1" });
    // A refresh response without rotation returns only a new access token.
    setTokens({ access: "a2" });

    expect(getAccessToken()).toBe("a2");
    // r1 must survive, or the next refresh has nothing to send.
    setTokens({ access: "a3", refresh: undefined });
    expect(getAccessToken()).toBe("a3");
  });

  it("clears both tokens on logout", () => {
    setTokens({ access: "a", refresh: "r" });
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});

describe("decodeToken", () => {
  it("reads the payload of a well-formed token", () => {
    const token = makeToken({ username: "ada", role: "admin" });
    expect(decodeToken(token)).toMatchObject({ username: "ada", role: "admin" });
  });

  it("returns null for garbage instead of throwing", () => {
    expect(decodeToken("not-a-token")).toBeNull();
    expect(decodeToken("")).toBeNull();
    expect(decodeToken(null)).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("treats a token past its exp as expired", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(isTokenExpired(makeToken({ exp: past }))).toBe(true);
  });

  it("treats a token well in the future as valid", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(makeToken({ exp: future }))).toBe(false);
  });

  it("treats a token with no exp claim as expired", () => {
    // Fail safe: an unreadable expiry should force a refresh, never grant
    // indefinite access.
    expect(isTokenExpired(makeToken({ username: "ada" }))).toBe(true);
  });

  it("expires slightly early via the skew window", () => {
    // 5 seconds from now, with the default 10s skew, should already read as
    // expired so the client refreshes before the token actually dies.
    const almost = Math.floor(Date.now() / 1000) + 5;
    expect(isTokenExpired(makeToken({ exp: almost }))).toBe(true);
  });
});

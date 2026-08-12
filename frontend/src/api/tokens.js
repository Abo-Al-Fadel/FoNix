/**
 * Token storage.
 *
 * Kept in localStorage. The honest trade-off: localStorage is readable by any
 * script running on the page, so an XSS bug leaks the token -- an httpOnly
 * cookie would not. Cookies would in turn need CSRF protection and a shared
 * parent domain, which a decoupled SPA on a different origin does not have.
 *
 * For this project localStorage is the right call, and the access token's short
 * 30-minute lifetime (set in the Django settings) limits what a leak is worth.
 * A production system handling real payments should revisit this.
 *
 * Every read and write goes through this module rather than touching
 * localStorage directly, so the storage decision can be changed in one file.
 */

const ACCESS_KEY = "fonix.auth.access";
const REFRESH_KEY = "fonix.auth.refresh";

/**
 * Safari in private mode throws on localStorage access rather than returning
 * null, which would take the whole app down at import time. Everything here is
 * wrapped so a storage failure degrades to "logged out" instead of a crash.
 */
function safeRead(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Storage unavailable: the session simply won't survive a refresh.
  }
}

export const getAccessToken = () => safeRead(ACCESS_KEY);
export const getRefreshToken = () => safeRead(REFRESH_KEY);

export function setTokens({ access, refresh }) {
  safeWrite(ACCESS_KEY, access);
  // The refresh endpoint only returns a new refresh token when rotation is on,
  // so leave the stored one alone when the response omits it.
  if (refresh !== undefined) safeWrite(REFRESH_KEY, refresh);
}

export function clearTokens() {
  safeWrite(ACCESS_KEY, null);
  safeWrite(REFRESH_KEY, null);
}

/**
 * Decode a JWT payload without verifying it.
 *
 * Safe *only* for reading non-security-critical hints in the UI, which is all
 * this is used for. The signature is not checked here and cannot be -- the
 * server is the only party that can validate a token, and every protected
 * endpoint does. Never gate anything that matters on this.
 */
export function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    // JWT uses base64url, which swaps two characters versus standard base64.
    const normalised = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalised));
  } catch {
    return null;
  }
}

/** True when the token is absent, unreadable, or past its expiry. */
export function isTokenExpired(token, skewSeconds = 10) {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  // `exp` is in seconds; Date.now() is milliseconds. A small skew means we
  // refresh just before expiry rather than racing it.
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

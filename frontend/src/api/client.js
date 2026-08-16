import axios from "axios";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./tokens.js";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

/**
 * The one configured axios instance the whole app uses.
 *
 * Importing bare `axios` anywhere else would bypass the interceptors below and
 * silently produce unauthenticated requests, so every call goes through this.
 */
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

/**
 * A second, interceptor-free instance used *only* to refresh the token.
 *
 * This matters: if the refresh call went through `api`, a failing refresh would
 * return 401, trip the response interceptor, and trigger another refresh --
 * an infinite loop.
 */
const refreshClient = axios.create({ baseURL });

// --------------------------------------------------------------------------- //
// Request: attach the access token
// --------------------------------------------------------------------------- //

api.interceptors.request.use((config) => {
  if (config.skipAuth) {
    return config;
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --------------------------------------------------------------------------- //
// Response: refresh once on 401, then replay the original request
// --------------------------------------------------------------------------- //

/**
 * Holds the in-flight refresh promise.
 *
 * Without this, a page that fires four requests at once with an expired token
 * would kick off four parallel refreshes. With ROTATE_REFRESH_TOKENS on in
 * Django, three of those four would be using a refresh token that the first
 * one just invalidated -- so the user would be logged out at random. Sharing a
 * single promise means the first 401 refreshes and the rest wait for it.
 */
let refreshPromise = null;

/** Called when the session is unrecoverable, so AuthContext can react. */
let onSessionExpired = () => {};

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token available.");

  const { data } = await refreshClient.post("/auth/refresh/", { refresh });
  setTokens({ access: data.access, refresh: data.refresh });
  return data.access;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Only a 401 is worth retrying. A 403 means the server understood exactly
    // who the caller is and refused anyway -- refreshing the token would
    // change nothing, and retrying would just repeat a forbidden action.
    const shouldRetry = status === 401 && original && !original._retried;

    if (!shouldRetry) {
      return Promise.reject(error);
    }

    // A 401 from the login endpoint means bad credentials, not a stale token.
    if (original.url?.includes("/auth/login/")) {
      return Promise.reject(error);
    }

    original._retried = true;

    try {
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const access = await refreshPromise;
      original.headers.Authorization = `Bearer ${access}`;
      return api(original);
    } catch (refreshError) {
      // The refresh token is gone or expired: this session is genuinely over.
      clearTokens();
      onSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      // Cleared whether it resolved or rejected, so the next 401 starts a
      // fresh attempt instead of awaiting a promise that already failed.
      refreshPromise = null;
    }
  },
);

/**
 * Flattens DRF's error shapes into a single readable string.
 *
 * DRF returns field errors as {field: ["msg"]}, non-field errors under
 * "detail" or "non_field_errors", and network failures have no response body at
 * all. Every form in the app needs the same treatment, so it lives here rather
 * than being re-derived in each one.
 */
export function extractErrorMessage(error, fallback = "Something went wrong.") {
  const data = error?.response?.data;

  if (!data) {
    return error?.message === "Network Error"
      ? "Could not reach the FoNix server. Is the backend running?"
      : fallback;
  }

  if (typeof data === "string") return data;
  if (data.detail) return data.detail;

  const firstField = Object.entries(data)[0];
  if (!firstField) return fallback;

  const [field, value] = firstField;
  const message = Array.isArray(value) ? value[0] : String(value);

  // Prefix with the field name unless it is a non-field error, so the user can
  // tell which input the message is about.
  return field === "non_field_errors" ? message : `${humanise(field)}: ${message}`;
}

function humanise(field) {
  return field
    .replace(/_/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

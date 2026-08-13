import { api } from "./client.js";

/**
 * Every network call the app makes, in one place.
 *
 * Components import these instead of calling api.get("/cars/") inline. It keeps
 * URL strings out of the UI, gives each call one obvious place to grow error
 * handling or caching, and means a backend route change is a one-line edit
 * here rather than a search across the codebase.
 */

// --- Catalog ---------------------------------------------------------------

export async function fetchCars() {
  const { data } = await api.get("/cars/");
  // The API is paginated; the store grid wants the array. Unwrapping here means
  // no component has to know about the envelope. If the catalog ever outgrows
  // one page, this is the single place that has to learn to follow `next`.
  return data.results ?? data;
}

export async function fetchCar(slug) {
  const { data } = await api.get(`/cars/${slug}/`);
  return data;
}

// --- Auth ------------------------------------------------------------------

export async function login(credentials) {
  const { data } = await api.post("/auth/login/", credentials);
  return data; // { access, refresh, user }
}

export async function register(payload) {
  const { data } = await api.post("/auth/register/", payload);
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await api.get("/auth/me/");
  return data;
}

// --- Orders ----------------------------------------------------------------

export async function fetchOrders() {
  const { data } = await api.get("/orders/");
  return data.results ?? data;
}

/**
 * @param {Array<{slug: string, quantity: number}>} items
 *
 * Note what is *not* sent: no prices. The server reads those from its own
 * database, which is what stops a tampered request buying a hypercar for a
 * pound. Sending them would be harmless (the API ignores them) but misleading
 * to anyone reading this code.
 */
export async function createOrder(items) {
  const { data } = await api.post("/orders/", {
    items: items.map((item) => ({ car: item.slug, quantity: item.quantity })),
  });
  return data;
}

// --- Contact ---------------------------------------------------------------

export async function sendContactMessage(payload) {
  const { data } = await api.post("/contact/", payload);
  return data;
}

// --- Control panel (staff and above) ---------------------------------------
//
// These hit endpoints the server gates by role. The UI hides the links that
// reach them, but that is convenience only -- a customer who calls these
// directly gets a 403 from DRF. See src/lib/roles.js and the backend's
// permission classes.

/**
 * Advance an order's fulfilment status (admin+). The server validates that the
 * transition is legal and returns the updated order.
 */
export async function updateOrderStatus(orderId, status) {
  const { data } = await api.patch(`/orders/${orderId}/status/`, { status });
  return data;
}

// The car list/detail already come from fetchCars/fetchCar; for staff those
// same endpoints return the fuller admin shape (including cost and
// is_published) and every car, hidden ones included.

export async function createCar(payload) {
  // multipart, because a new car carries an uploaded thumbnail file.
  const { data } = await api.post("/cars/", payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateCar(slug, payload) {
  // PATCH so unchanged fields (including the existing thumbnail) are left alone.
  const isMultipart = typeof FormData !== "undefined" && payload instanceof FormData;
  const { data } = await api.patch(`/cars/${slug}/`, payload, {
    headers: isMultipart ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return data;
}

export async function deleteCar(slug) {
  await api.delete(`/cars/${slug}/`);
}

// --- User management (admin and above) -------------------------------------

export async function fetchUsers() {
  const { data } = await api.get("/admin/users/");
  return data.results ?? data;
}

export async function updateUser(id, patch) {
  const { data } = await api.patch(`/admin/users/${id}/`, patch);
  return data;
}

/**
 * Display formatting helpers.
 *
 * Centralised so a price is written the same way on a catalog card, a product
 * page, the cart and an order confirmation. Four hand-rolled toFixed(2) calls
 * would eventually disagree with each other.
 */

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  // Hypercar prices have no meaningful pence, and "£2,400,000.00" is harder to
  // read at a glance than "£2,400,000".
  maximumFractionDigits: 0,
});

/** @param {string|number} value - DRF sends decimals as strings. */
export function formatPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? gbp.format(number) : "—";
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

/**
 * The three headline specs, in the order they appear everywhere on the site.
 * Returning a single shaped array keeps the spec strip identical between the
 * store card and the product page.
 */
export function headlineSpecs(car) {
  return [
    { label: "Range", value: `${car.range_km}`, unit: "km" },
    { label: "Top speed", value: `${car.top_speed_kmh}`, unit: "km/h" },
    // Number() strips the trailing zero DRF sends on a DecimalField, so "2.10"
    // renders as the "2.1" a spec sheet would print.
    { label: "0–100", value: `${Number(car.acceleration_0_100)}`, unit: "s" },
  ];
}

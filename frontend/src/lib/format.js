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
  return Number.isFinite(number) ? gbp.format(number) : "-";
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
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

/** @param {string|number} value */
export function formatPriceDelta(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return "Included";
  const formatted = formatPrice(Math.abs(number));
  return number > 0 ? `+${formatted}` : `−${formatted}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? "-" : dateTimeFormatter.format(date);
}

/**
 * Full spec sheet for the product page. Empty / null values are dropped so a
 * car still being specified does not print a table of dashes.
 */
export function specSheet(car) {
  const rows = [
    { label: "Power", value: car.power_kw != null ? `${car.power_kw} kW` : null },
    { label: "Torque", value: car.torque_nm != null ? `${car.torque_nm} Nm` : null },
    { label: "Kerb weight", value: car.weight_kg != null ? `${car.weight_kg} kg` : null },
    {
      label: "Battery",
      value: car.battery_kwh != null ? `${Number(car.battery_kwh)} kWh` : null,
    },
    {
      label: "DC 10–80%",
      value: car.charge_10_80_min != null ? `${car.charge_10_80_min} min` : null,
    },
    { label: "AC charge", value: car.ac_kw != null ? `${Number(car.ac_kw)} kW` : null },
    { label: "Length", value: car.length_mm != null ? `${car.length_mm} mm` : null },
    { label: "Width", value: car.width_mm != null ? `${car.width_mm} mm` : null },
    { label: "Height", value: car.height_mm != null ? `${car.height_mm} mm` : null },
    { label: "Seats", value: car.seats != null ? `${car.seats}` : null },
    { label: "Drivetrain", value: car.drivetrain || null },
    { label: "Motors", value: car.motor_count != null ? `${car.motor_count}` : null },
    { label: "Body", value: car.body_style || null },
    {
      label: "Warranty",
      value: car.warranty_years != null ? `${car.warranty_years} years` : null,
    },
    { label: "Service", value: car.service_interval || null },
    { label: "Built in", value: car.country_of_build || null },
    { label: "Homologation", value: car.homologation || null },
    {
      label: "Lead time",
      value: car.lead_time_weeks != null ? `${car.lead_time_weeks} weeks` : null,
    },
  ];
  return rows.filter((row) => row.value);
}

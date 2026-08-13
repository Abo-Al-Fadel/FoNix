/**
 * Order fulfilment lifecycle, mirrored from the backend
 * (orders/models.py::Order.Status + ALLOWED_TRANSITIONS).
 *
 * The frontend uses this to label statuses and to offer only the legal next
 * steps in the tracking UI. The server re-validates every transition, so a
 * mismatch here can never let an illegal change through -- it would just show a
 * button the API then refuses.
 */

export const ORDER_STATUS = {
  pending: { label: "Pending", next: ["confirmed", "cancelled"] },
  confirmed: { label: "Confirmed", next: ["in_production", "cancelled"] },
  in_production: { label: "In production", next: ["in_transit", "cancelled"] },
  in_transit: { label: "In transit", next: ["delivered", "cancelled"] },
  delivered: { label: "Delivered", next: [] },
  cancelled: { label: "Cancelled", next: [] },
};

/** The legal next statuses from where an order currently is. */
export function nextStatuses(status) {
  return ORDER_STATUS[status]?.next ?? [];
}

export function statusLabel(status) {
  return ORDER_STATUS[status]?.label ?? status;
}

/** Tailwind classes for a status badge. Active stages read ember; the terminal
 *  states are visually distinct (delivered settled, cancelled faded). */
export function statusTone(status) {
  return (
    {
      pending: "border-hairline text-muted",
      confirmed: "border-ember/50 text-ember",
      in_production: "border-ember/50 text-ember",
      in_transit: "border-ember/50 text-ember",
      delivered: "border-ice/40 text-ice",
      cancelled: "border-hairline text-faint",
    }[status] ?? "border-hairline text-muted"
  );
}

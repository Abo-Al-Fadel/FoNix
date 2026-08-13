import { statusTone } from "../../lib/orderStatus.js";

/**
 * A small badge for an order's fulfilment status. One component so the customer
 * account page and the admin tracking view show the same colour for the same
 * stage.
 */
export default function StatusPill({ status, children }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1.5 font-body text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(
        status,
      )}`}
    >
      {children}
    </span>
  );
}

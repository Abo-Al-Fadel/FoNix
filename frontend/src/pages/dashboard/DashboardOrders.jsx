import { useCallback, useMemo, useState } from "react";

import { extractErrorMessage } from "../../api/client.js";
import { fetchOrders, updateOrderStatus } from "../../api/endpoints.js";
import {
  DeliveryBlock,
  OrderLineItems,
  OrderTimeline,
} from "../../components/orders/OrderDetails.jsx";
import FormError from "../../components/ui/FormError.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/StateBlock.jsx";
import StatusPill from "../../components/ui/StatusPill.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useApiResource from "../../hooks/useApiResource.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { nextStatuses, statusLabel } from "../../lib/orderStatus.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_production", label: "In production" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

/**
 * Order list for staff and above. Staff can read every allocation; only
 * admin/owner may advance or cancel it. The server validates each transition,
 * so the buttons are a convenience, not the rule.
 */
export default function DashboardOrders() {
  const { isAdmin } = useAuth();
  const fetcher = useCallback(() => fetchOrders(), []);
  const { data: orders, setData, error, isLoading, retry } = useApiResource(fetcher);

  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  const visible = useMemo(() => {
    if (!orders) return null;
    if (filter === "all") return orders;
    return orders.filter((order) => order.status === filter);
  }, [orders, filter]);

  async function advance(order, status) {
    setBusyId(order.id);
    setActionError("");
    const previous = order;
    setData((list) =>
      list.map((row) =>
        row.id === order.id
          ? { ...row, status, status_display: statusLabel(status) }
          : row,
      ),
    );
    try {
      const updated = await updateOrderStatus(order.id, status);
      setData((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    } catch (caught) {
      setData((list) => list.map((row) => (row.id === previous.id ? previous : row)));
      setActionError(extractErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 className="mb-2 font-heading text-xl font-bold text-white md:text-2xl">
        Orders
      </h2>
      <p className="mb-6 font-body text-sm text-muted">
        {isAdmin
          ? "Advance an allocation one stage at a time, or cancel it before delivery. Cancelling returns the held build slot."
          : "Staff can read every allocation. Confirming, advancing or cancelling is an admin action."}
      </p>

      {orders?.length ? (
        <div
          role="group"
          aria-label="Filter orders by status"
          className="mb-6 flex flex-wrap gap-2"
        >
          {FILTERS.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                aria-pressed={active}
                className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? "border-ember/50 bg-ember/15 text-ember"
                    : "border-hairline text-muted hover:border-white/25 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {actionError ? <FormError>{actionError}</FormError> : null}
      {isLoading && !orders ? <LoadingState label="Loading orders" /> : null}
      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {orders && orders.length === 0 ? (
        <EmptyState title="No orders yet">
          Allocations placed through the store appear here for fulfilment.
        </EmptyState>
      ) : null}

      {visible && visible.length === 0 && orders?.length > 0 ? (
        <EmptyState title="Nothing in this stage">
          No allocations match that filter.
        </EmptyState>
      ) : null}

      {visible && visible.length > 0 ? (
        <ul className="list-none space-y-4">
          {visible.map((order) => (
            <li
              key={order.id}
              className="rounded-card border border-hairline bg-graphite/50 p-5 md:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <h3 className="font-heading text-base font-bold text-white">
                    Allocation #{order.id}
                  </h3>
                  <p className="mt-1 font-body text-sm text-muted">
                    {order.customer ? `${order.customer} · ` : ""}
                    {order.customer_email ? `${order.customer_email} · ` : ""}
                    {formatDate(order.created_at)} · {order.item_count}{" "}
                    {order.item_count === 1 ? "car" : "cars"} ·{" "}
                    {formatPrice(order.total)}
                  </p>
                </div>
                <StatusPill status={order.status}>{order.status_display}</StatusPill>
              </div>

              <OrderLineItems items={order.items} />
              <DeliveryBlock delivery={order.delivery} />
              <OrderTimeline events={order.events} />

              {isAdmin ? (
                nextStatuses(order.status).length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                    <span className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                      Move to
                    </span>
                    {nextStatuses(order.status).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => advance(order, status)}
                        disabled={busyId === order.id}
                        className={`rounded-full border px-3.5 py-1.5 font-body text-xs uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                          status === "cancelled"
                            ? "border-hairline text-faint hover:border-ember/40 hover:text-ember"
                            : "border-ember/40 text-ember hover:bg-ember/10"
                        }`}
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 border-t border-hairline pt-4 font-body text-xs text-faint">
                    This allocation is {order.status_display.toLowerCase()} — no
                    further steps.
                  </p>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

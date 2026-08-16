import { useCallback, useState } from "react";

import { extractErrorMessage } from "../../api/client.js";
import { fetchOrders, updateOrderStatus } from "../../api/endpoints.js";
import FormError from "../../components/ui/FormError.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/StateBlock.jsx";
import StatusPill from "../../components/ui/StatusPill.jsx";
import useApiResource from "../../hooks/useApiResource.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { nextStatuses, statusLabel } from "../../lib/orderStatus.js";

/**
 * Order fulfilment tracking for admins and owners. Lists every order with its
 * customer, and offers only the legal next stages to advance it through. The
 * server validates each transition, so the buttons are a convenience, not the
 * rule.
 */
export default function DashboardOrders() {
  const fetcher = useCallback(() => fetchOrders(), []);
  const { data: orders, setData, error, isLoading, retry } = useApiResource(fetcher);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

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
      <h2 className="mb-6 font-heading text-xl font-bold text-white md:text-2xl">
        Orders
      </h2>

      {actionError ? <FormError>{actionError}</FormError> : null}
      {isLoading && !orders ? <LoadingState label="Loading orders" /> : null}
      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {orders && orders.length === 0 ? (
        <EmptyState title="No orders yet">
          Orders placed through the store appear here for fulfilment.
        </EmptyState>
      ) : null}

      {orders && orders.length > 0 ? (
        <ul className="list-none space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-card border border-hairline bg-graphite/50 p-5 md:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <h3 className="font-heading text-base font-bold text-white">
                    Order #{order.id}
                  </h3>
                  <p className="mt-1 font-body text-sm text-muted">
                    {order.customer ? `${order.customer} · ` : ""}
                    {formatDate(order.created_at)} · {order.item_count}{" "}
                    {order.item_count === 1 ? "car" : "cars"} ·{" "}
                    {formatPrice(order.total)}
                  </p>
                </div>
                <StatusPill status={order.status}>
                  {order.status_display}
                </StatusPill>
              </div>

              {nextStatuses(order.status).length > 0 ? (
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
                  This order is {order.status_display.toLowerCase()} — no further
                  steps.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

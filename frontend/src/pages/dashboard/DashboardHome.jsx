import { useCallback } from "react";
import { Link } from "react-router-dom";

import { fetchCars, fetchOrders, fetchUsers } from "../../api/endpoints.js";
import AnimatedNumber from "../../components/ui/AnimatedNumber.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useApiResource from "../../hooks/useApiResource.js";

/**
 * The dashboard landing: a few headline counts, scoped to the viewer's role.
 * Staff see the catalogue figure; admins also see orders and users. The richer
 * revenue/profit analytics arrive in Phase 2 -- this is the operational
 * at-a-glance.
 */
export default function DashboardHome() {
  const { isAdmin } = useAuth();

  const carsFetcher = useCallback(() => fetchCars(), []);
  const ordersFetcher = useCallback(() => fetchOrders(), []);
  const usersFetcher = useCallback(() => fetchUsers(), []);

  const { data: cars } = useApiResource(carsFetcher);
  // Only admins may call these endpoints; `enabled` keeps staff from firing a
  // request the server would 403.
  const { data: orders } = useApiResource(ordersFetcher, { enabled: isAdmin });
  const { data: users } = useApiResource(usersFetcher, { enabled: isAdmin });

  const publishedCars = cars?.filter((c) => c.is_published !== false).length;
  const pendingOrders = orders?.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  ).length;

  const tiles = [
    { label: "Cars in catalogue", value: cars?.length, sub: `${publishedCars ?? "—"} live`, to: "/dashboard/cars" },
    isAdmin && { label: "Orders", value: orders?.length, sub: `${pendingOrders ?? "—"} in progress`, to: "/dashboard/orders" },
    isAdmin && { label: "Accounts", value: users?.length, sub: "registered", to: "/dashboard/users" },
  ].filter(Boolean);

  return (
    <div>
      <h2 className="font-heading text-xl font-bold text-white md:text-2xl">
        At a glance
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="fx-sheen group rounded-card border border-hairline bg-graphite/50 p-6 transition-colors hover:border-white/20"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-faint">
              {tile.label}
            </p>
            <p className="mt-3 font-heading text-4xl font-bold text-white">
              {typeof tile.value === "number" ? (
                <AnimatedNumber value={tile.value} />
              ) : (
                "—"
              )}
            </p>
            <p className="mt-1 font-body text-xs text-muted">{tile.sub}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 max-w-2xl font-body text-sm leading-relaxed text-faint">
        Revenue, margin and the audit trail land in the next phase. This first
        release is the operational panel: manage the catalogue, track orders
        through fulfilment, and administer accounts.
      </p>
    </div>
  );
}

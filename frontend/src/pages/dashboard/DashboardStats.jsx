import { useCallback } from "react";
import { Link } from "react-router-dom";

import { fetchStats } from "../../api/endpoints.js";
import AnimatedNumber from "../../components/ui/AnimatedNumber.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useApiResource from "../../hooks/useApiResource.js";
import { formatPrice } from "../../lib/format.js";
import { statusLabel } from "../../lib/orderStatus.js";

/**
 * Operational hangar stats for admin; P&L tiles for owner.
 * Staff cannot reach this route. Cost and margin never leave the owner payload.
 */
export default function DashboardStats() {
  const { isOwner } = useAuth();
  const fetcher = useCallback(() => fetchStats(), []);
  const { data: stats } = useApiResource(fetcher);

  const pipeline = stats?.pipeline_value;
  const counts = [
    { label: "Allocations", value: stats?.orders_total, sub: "all time" },
    { label: "In progress", value: stats?.in_progress, sub: "not delivered or cancelled" },
    { label: "Cars live", value: stats?.cars_live, sub: `${stats?.slots_remaining ?? "—"} slots left` },
    { label: "Accounts", value: stats?.accounts, sub: "registered" },
  ];

  const money = [
    { label: "Pipeline", value: pipeline, hint: "Live allocations, not cancelled" },
    isOwner && { label: "Revenue", value: stats?.revenue, hint: "Confirmed through delivered" },
    isOwner && { label: "Build cost", value: stats?.build_cost, hint: "Internal. Staff never see this." },
    isOwner && { label: "Margin", value: stats?.margin, hint: "Revenue minus build cost" },
    isOwner && {
      label: "Deposits authorised",
      value: stats?.deposits_authorised,
      hint: "Demonstration 10% on live orders",
    },
  ].filter(Boolean);

  return (
    <div>
      <h2 className="font-heading text-xl font-bold text-white md:text-2xl">
        Hangar
      </h2>
      <p className="mt-2 max-w-2xl font-body text-sm text-muted">
        {isOwner
          ? "Operational counts plus the figures the shop floor must not see: cost, margin, authorised deposits."
          : "Operational counts. Revenue, build cost and margin are owner-only."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {counts.map((tile) => (
          <div
            key={tile.label}
            className="rounded-card border border-hairline bg-graphite/50 p-4 sm:p-6"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-faint">
              {tile.label}
            </p>
            <p className="mt-3 font-heading text-3xl font-bold text-white sm:text-4xl">
              {typeof tile.value === "number" ? (
                <AnimatedNumber value={tile.value} />
              ) : (
                "—"
              )}
            </p>
            <p className="mt-1 font-body text-xs text-muted">{tile.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {money.map((tile) => (
          <div
            key={tile.label}
            className="rounded-card border border-hairline bg-graphite/50 p-5 sm:p-6"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-faint">
              {tile.label}
            </p>
            <p className="mt-3 font-heading text-2xl font-bold text-white sm:text-3xl">
              {tile.value != null ? formatPrice(tile.value) : "—"}
            </p>
            <p className="mt-1 font-body text-xs text-muted">{tile.hint}</p>
          </div>
        ))}
      </div>

      {stats?.by_status ? (
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(stats.by_status).map(([status, count]) => (
            <div key={status} className="bg-void px-4 py-5">
              <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                {statusLabel(status)}
              </dt>
              <dd className="mt-2 font-heading text-xl font-bold text-white">
                {count}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-8 font-body text-sm text-faint">
        <Link to="/dashboard/orders" className="text-muted underline-offset-4 hover:underline">
          Open allocations
        </Link>
      </p>
    </div>
  );
}

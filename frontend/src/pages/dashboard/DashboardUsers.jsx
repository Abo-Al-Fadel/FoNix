import { useCallback, useState } from "react";

import { extractErrorMessage } from "../../api/client.js";
import { fetchUsers, updateUser } from "../../api/endpoints.js";
import FormError from "../../components/ui/FormError.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/StateBlock.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useApiResource from "../../hooks/useApiResource.js";
import { formatPrice } from "../../lib/format.js";
import { rankOf } from "../../lib/roles.js";

const ALL_ROLES = ["customer", "staff", "admin", "owner"];
const ROLE_LABEL = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
  owner: "Owner",
};

/**
 * User management for admins and owners.
 *
 * The controls mirror the server guardrails so nobody is offered an action the
 * API would refuse: you cannot edit your own row here, an admin cannot touch an
 * owner, and the role menu only offers roles at or below your own rank. The
 * server is still the authority -- these rules just keep the UI honest.
 */
export default function DashboardUsers() {
  const { user: me } = useAuth();
  const myRank = rankOf(me?.role);

  const fetcher = useCallback(() => fetchUsers(), []);
  const { data: users, setData, error, isLoading, retry } = useApiResource(fetcher);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function patch(target, body) {
    setBusyId(target.id);
    setActionError("");
    const previous = target;
    setData((list) =>
      list.map((row) => (row.id === target.id ? { ...row, ...body } : row)),
    );
    try {
      const updated = await updateUser(target.id, body);
      setData((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    } catch (caught) {
      setData((list) => list.map((row) => (row.id === previous.id ? previous : row)));
      setActionError(extractErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  // Whether the signed-in user may act on this row at all (mirrors CanManageUser).
  const canManage = (target) =>
    target.id !== me?.id && !(rankOf(target.role) >= rankOf("owner") && myRank < rankOf("owner"));

  // Role options this viewer may assign: nothing above their own rank.
  const assignableRoles = ALL_ROLES.filter((role) => rankOf(role) <= myRank);

  return (
    <div>
      <h2 className="mb-6 font-heading text-xl font-bold text-white md:text-2xl">
        Accounts
      </h2>

      {actionError ? <FormError>{actionError}</FormError> : null}
      {isLoading && !users ? <LoadingState label="Loading accounts" /> : null}
      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {users && users.length === 0 ? (
        <EmptyState title="No accounts">No users have registered yet.</EmptyState>
      ) : null}

      {users && users.length > 0 ? (
        <>
          <ul className="list-none space-y-3 md:hidden">
            {users.map((row) => {
              const manageable = canManage(row) && busyId !== row.id;
              const isSelf = row.id === me?.id;
              return (
                <li
                  key={row.id}
                  className="rounded-card border border-hairline bg-graphite/50 p-4"
                >
                  <p className="font-heading text-base font-semibold text-white">
                    {row.username}
                    {isSelf ? (
                      <span className="ml-2 font-body text-[10px] uppercase tracking-[0.14em] text-faint">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted">{row.email}</p>
                  <p className="mt-2 font-body text-sm text-muted">
                    {row.order_count} orders · {formatPrice(row.total_spent)}
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <select
                      value={row.role}
                      disabled={!manageable}
                      onChange={(e) => patch(row, { role: e.target.value })}
                      className="min-h-11 rounded-input border border-hairline bg-graphite/60 px-3 font-body text-sm text-white disabled:opacity-50"
                    >
                      {[...new Set([row.role, ...assignableRoles])].map((role) => (
                        <option key={role} value={role} disabled={!assignableRoles.includes(role)}>
                          {ROLE_LABEL[role] ?? role}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!manageable}
                      onClick={() => patch(row, { is_active: !row.is_active })}
                      className={`min-h-11 rounded-full border px-3 font-body text-[10px] font-medium uppercase tracking-[0.14em] disabled:opacity-50 ${
                        row.is_active
                          ? "border-ice/40 text-ice"
                          : "border-hairline text-faint"
                      }`}
                    >
                      {row.is_active ? "Active" : "Disabled"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-card border border-hairline md:block">
            <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline bg-graphite/40 font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Spent</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                const manageable = canManage(row) && busyId !== row.id;
                const isSelf = row.id === me?.id;
                return (
                  <tr key={row.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-heading text-sm font-semibold text-white">
                        {row.username}
                        {isSelf ? (
                          <span className="ml-2 font-body text-[10px] uppercase tracking-[0.14em] text-faint">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="font-body text-xs text-muted">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-muted">
                      {row.order_count}
                    </td>
                    <td className="px-4 py-3 font-body text-sm text-muted">
                      {formatPrice(row.total_spent)}
                    </td>
                    <td className="px-4 py-3">
                      {/* An owner's role is only editable by another owner; the
                          menu also never offers a role above the viewer's rank. */}
                      <select
                        value={row.role}
                        disabled={!manageable}
                        onChange={(e) => patch(row, { role: e.target.value })}
                        className="rounded-input border border-hairline bg-graphite/60 px-3 py-2 font-body text-sm text-white disabled:opacity-50"
                      >
                        {/* Ensure the current role always shows even if it is
                            above what this viewer could assign. */}
                        {[...new Set([row.role, ...assignableRoles])].map((role) => (
                          <option key={role} value={role} disabled={!assignableRoles.includes(role)}>
                            {ROLE_LABEL[role] ?? role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!manageable}
                        onClick={() => patch(row, { is_active: !row.is_active })}
                        className={`rounded-full border px-3 py-1.5 font-body text-[10px] font-medium uppercase tracking-[0.14em] transition-colors disabled:opacity-50 ${
                          row.is_active
                            ? "border-ice/40 text-ice hover:border-ember/40 hover:text-ember"
                            : "border-hairline text-faint hover:border-ice/40 hover:text-ice"
                        }`}
                      >
                        {row.is_active ? "Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      ) : null}

      <p className="mt-6 max-w-2xl font-body text-xs leading-relaxed text-faint">
        You cannot change your own role or status here, and only an owner can
        manage another owner. Deactivating an account is reversible; there is no
        hard delete, because an account with orders is kept for the record.
      </p>
    </div>
  );
}

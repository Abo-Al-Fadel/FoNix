/**
 * The role hierarchy, mirrored from the backend (accounts/models.py::ROLE_RANK).
 *
 * These checks decide only what the UI *shows*. Every privileged action is
 * enforced server-side by the matching permission class -- the frontend hiding
 * a button is a convenience, never the security boundary.
 */

export const ROLE_RANK = {
  customer: 0,
  staff: 1,
  admin: 2,
  owner: 3,
};

/** Numeric rank for a role string; unknown/missing roles rank as customer (0). */
export function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

/** Whether `role` sits at or above `minRole` in the hierarchy. */
export function hasAtLeast(role, minRole) {
  return rankOf(role) >= rankOf(minRole);
}

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { hasAtLeast } from "../../lib/roles.js";
import { LoadingState } from "../ui/StateBlock.jsx";

/**
 * Gate for routes that need a minimum role.
 *
 * Same contract as RequireAuth: it controls *navigation*, not access. The real
 * boundary is the DRF permission classes -- a customer who forces their way to
 * /dashboard sees a page whose every API call the server answers with 403. This
 * just keeps them from landing somewhere confusing.
 *
 * Props:
 *   min  -- the lowest role allowed ("staff" | "admin" | "owner").
 */
export default function RequireRole({ min = "staff" }) {
  const { isAuthenticated, isRestoring, user } = useAuth();
  const location = useLocation();

  // While the session restores from localStorage we do not yet know the role;
  // redirecting now would bounce a valid admin on every hard refresh.
  if (isRestoring) {
    return <LoadingState label="Checking your access" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Signed in but not senior enough: send them home rather than to login (they
  // are not going to fix it by re-authenticating as the same account).
  if (!hasAtLeast(user?.role, min)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

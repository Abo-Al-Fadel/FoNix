import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import { LoadingState } from "../ui/StateBlock.jsx";

/**
 * Gate for routes that need a signed-in user.
 *
 * To be clear about what this is and is not: it controls *navigation*, not
 * access. It stops a logged-out visitor landing on a page that would only show
 * them errors. The actual protection is server-side -- /api/orders/ is scoped
 * to request.user and returns 401 to anyone else, so removing this component
 * would leak nothing.
 */
export default function RequireAuth() {
  const { isAuthenticated, isRestoring } = useAuth();
  const location = useLocation();

  // Critical: while the session is still being restored from localStorage we
  // do not yet know whether anyone is logged in. Redirecting here would bounce
  // a perfectly valid session to the login page on every hard refresh.
  if (isRestoring) {
    return <LoadingState label="Checking your session" />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        // replace, so the protected URL does not end up in history -- pressing
        // Back from the login page should not return to a page that just
        // redirected away.
        replace
        // Where they were heading, so login can send them onwards afterwards
        // instead of dumping everyone on the homepage.
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

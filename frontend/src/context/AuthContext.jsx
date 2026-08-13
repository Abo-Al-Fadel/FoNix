import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { setSessionExpiredHandler } from "../api/client.js";
import * as endpoints from "../api/endpoints.js";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "../api/tokens.js";
import { hasAtLeast } from "../lib/roles.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  /**
   * Distinguishes "we have not checked yet" from "checked, nobody is logged
   * in". Without it, a protected route would bounce a logged-in user to the
   * login page for the split second before their profile arrives -- a bug that
   * only appears on a hard refresh, which is exactly when it is most annoying.
   */
  const [isRestoring, setIsRestoring] = useState(true);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  // Restore the session on first mount.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getAccessToken() && !getRefreshToken()) {
        setIsRestoring(false);
        return;
      }

      try {
        // The access token may well be expired here. That is fine and is the
        // point: this request 401s, the axios interceptor silently refreshes,
        // and the retry succeeds -- so a returning user stays logged in
        // without ever seeing it happen.
        const profile = await endpoints.fetchCurrentUser();
        if (!cancelled) setUser(profile);
      } catch {
        // Refresh token is dead too. Genuinely logged out.
        if (!cancelled) clearTokens();
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    restore();
    // The cancelled flag stops a state update landing after unmount -- which
    // StrictMode's double-mount in development would otherwise trigger.
    return () => {
      cancelled = true;
    };
  }, []);

  // Let the axios layer tell us when a refresh failed mid-session, so the UI
  // updates instead of showing a logged-in navbar over failing requests.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(() => {});
  }, []);

  const signIn = useCallback(async (credentials) => {
    const data = await endpoints.login(credentials);
    setTokens({ access: data.access, refresh: data.refresh });
    setUser(data.user);
    return data.user;
  }, []);

  const signUp = useCallback(
    async (payload) => {
      await endpoints.register(payload);
      // Log straight in afterwards. Making someone who just typed their
      // password twice type it a third time is a needless drop-off point.
      return signIn({
        username: payload.username,
        password: payload.password,
      });
    },
    [signIn],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      // The three role tiers, mirrored from the server hierarchy and used only
      // to decide what to *show*. The API enforces the real thing -- see the
      // IsStaffMember / IsAdmin / IsOwner permission classes. `isAdmin` keeps
      // its old name and now means "admin or owner", matching the backend.
      isStaff: hasAtLeast(user?.role, "staff"),
      isAdmin: hasAtLeast(user?.role, "admin"),
      isOwner: hasAtLeast(user?.role, "owner"),
      isRestoring,
      signIn,
      signUp,
      logout,
    }),
    // Memoised so consumers don't re-render on every provider render. Without
    // this, a new object identity each render would defeat every downstream
    // memo in the tree.
    [user, isRestoring, signIn, signUp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // A clear error beats the "cannot destructure null" that would otherwise
    // appear several frames away from the actual mistake.
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return context;
}

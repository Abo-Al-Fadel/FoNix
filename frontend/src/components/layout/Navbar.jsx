import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";

import FoNixMark from "../brand/FoNixMark.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";

const LINKS = [
  { to: "/store", label: "Store" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount } = useCart();
  const drawerToggleRef = useRef(null);

  // Close the drawer whenever the route changes, so tapping a link inside it
  // does not leave the menu covering the page you just navigated to.
  useEffect(() => setIsDrawerOpen(false), [pathname]);

  // Escape closes the drawer -- the behaviour a keyboard user expects from
  // anything modal, and cheap to provide.
  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        // Return focus to the control that opened it, rather than dumping the
        // user back at the top of the document.
        drawerToggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-6">
      {/* The glass pill. pointer-events are re-enabled on the bar itself so the
          transparent header strip does not block clicks on the hero behind it. */}
      <nav
        aria-label="Primary"
        className="fx-glass pointer-events-auto flex w-full max-w-5xl items-center gap-2 rounded-full py-2 pl-4 pr-2 md:gap-6 md:pl-6"
      >
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 text-white transition-colors hover:text-ember"
          aria-label="FoNix — home"
        >
          <FoNixMark className="h-4 w-auto md:h-5" />
          <span className="font-heading text-sm font-bold tracking-[0.2em] md:text-base">
            FONIX
          </span>
        </Link>

        {/* Desktop links. Hidden below md, where the drawer takes over -- the
            pill has no room for full labels on a phone. */}
        <ul className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={navLinkClasses}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <NavLink
            to="/cart"
            className={navLinkClasses}
            // The count is inside the accessible name rather than only in a
            // visual badge, so it is announced rather than skipped.
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
          >
            <span aria-hidden="true">Cart</span>
            {itemCount > 0 ? (
              <span
                aria-hidden="true"
                className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-deep px-1 font-body text-[10px] font-semibold text-white"
              >
                {itemCount}
              </span>
            ) : null}
          </NavLink>

          {/* Account controls, desktop only -- the drawer carries them on mobile. */}
          <div className="hidden items-center gap-1 md:flex">
            {isAuthenticated ? (
              <>
                <NavLink to="/account" className={navLinkClasses}>
                  {user?.first_name || user?.username}
                </NavLink>
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-11 rounded-full px-4 font-body text-xs uppercase tracking-[0.14em] text-faint transition-colors hover:text-white"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login" className={navLinkClasses}>
                Sign in
              </NavLink>
            )}
          </div>

          <button
            ref={drawerToggleRef}
            type="button"
            onClick={() => setIsDrawerOpen((open) => !open)}
            // aria-expanded is what tells a screen reader whether the menu is
            // currently open; without it this is just an unlabelled button.
            aria-expanded={isDrawerOpen}
            aria-controls="mobile-drawer"
            aria-label={isDrawerOpen ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 md:hidden"
          >
            <HamburgerIcon isOpen={isDrawerOpen} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isDrawerOpen ? (
          <motion.div
            id="mobile-drawer"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fx-glass pointer-events-auto absolute inset-x-4 top-20 rounded-3xl p-3 md:hidden"
          >
            <ul className="flex flex-col">
              {LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} className={drawerLinkClasses}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
              <li className="my-1 h-px bg-hairline" aria-hidden="true" />
              {isAuthenticated ? (
                <>
                  <li>
                    <NavLink to="/account" className={drawerLinkClasses}>
                      Account
                    </NavLink>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex min-h-12 w-full items-center rounded-2xl px-4 font-body text-sm text-faint transition-colors hover:bg-white/5 hover:text-white"
                    >
                      Log out
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <NavLink to="/login" className={drawerLinkClasses}>
                      Sign in
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/register" className={drawerLinkClasses}>
                      Create account
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/**
 * NavLink hands its className a render prop with `isActive`, which is how the
 * current page gets the ember pill without any component needing to compare
 * pathnames itself.
 */
function navLinkClasses({ isActive }) {
  return [
    "inline-flex min-h-11 items-center rounded-full px-4",
    "font-body text-xs uppercase tracking-[0.14em] transition-colors duration-300",
    isActive ? "bg-ember/15 text-ember" : "text-muted hover:text-white",
  ].join(" ");
}

function drawerLinkClasses({ isActive }) {
  return [
    "flex min-h-12 items-center rounded-2xl px-4 font-body text-sm transition-colors",
    isActive ? "bg-ember/15 text-ember" : "text-white hover:bg-white/5",
  ].join(" ");
}

/** Two bars that cross into an X. aria-hidden -- the button carries the label. */
function HamburgerIcon({ isOpen }) {
  const base =
    "absolute h-px w-5 bg-current transition-transform duration-300 ease-[var(--ease-fonix)]";
  return (
    <span className="relative flex h-4 w-5 items-center" aria-hidden="true">
      <span
        className={base}
        style={{
          transform: isOpen ? "translateY(0) rotate(45deg)" : "translateY(-4px)",
        }}
      />
      <span
        className={base}
        style={{
          transform: isOpen ? "translateY(0) rotate(-45deg)" : "translateY(4px)",
        }}
      />
    </span>
  );
}

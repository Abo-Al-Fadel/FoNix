import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";

import FoNixMark from "../brand/FoNixMark.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion.js";

const LINKS = [
  { to: "/store", label: "Store" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount } = useCart();
  const drawerToggleRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Close the drawer on navigation, so tapping a link does not leave the menu
  // covering the page you just opened.
  useEffect(() => setIsDrawerOpen(false), [pathname]);

  // The bar deepens its glass once you scroll away from the top. Over the hero
  // it stays almost invisible; over content it earns a little more weight.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        // Return focus to the control that opened it rather than dumping the
        // user at the top of the document.
        drawerToggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-6">
      {/*
        OPENING ANIMATION.

        On load the bar unfurls: it starts clipped to a small pill on the left
        (just the mark showing, like a closed capsule) and the clip opens
        rightward to the full width, while the links fade in a beat behind it.
        clipPath is animated rather than width because clipping leaves the
        internal flex layout untouched, so nothing reflows or jumps as it opens.

        Reduced motion skips straight to the open state.
      */}
      <motion.nav
        aria-label="Primary"
        initial={
          prefersReducedMotion
            ? false
            : { clipPath: "inset(0% 87% 0% 0% round 999px)" }
        }
        animate={{ clipPath: "inset(0% 0% 0% 0% round 999px)" }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        // A darker, more present glass than before: a real tinted panel with a
        // clear hairline and a soft drop shadow, not a barely-there wash. It
        // deepens further once you scroll off the hero. `backdrop-saturate`
        // makes the ember background glow read through it, which is what stops
        // it looking like flat grey plastic.
        className={`pointer-events-auto flex w-full max-w-5xl items-center rounded-full border shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-500 ${
          isScrolled
            ? "border-white/15 bg-[rgba(9,11,16,0.78)]"
            : "border-white/12 bg-[rgba(9,11,16,0.5)]"
        } py-2 pl-5 pr-2 md:pl-6`}
      >
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 text-white transition-colors hover:text-ember"
          aria-label="FoNix home"
        >
          <FoNixMark className="h-4 w-auto transition-transform duration-500 ease-fonix group-hover:scale-110 md:h-5" />
          <span className="font-heading text-sm font-bold tracking-[0.2em] md:text-base">
            FONIX
          </span>
        </Link>

        {/*
          ONE evenly spaced row for every item.

          The previous version had `ml-auto` on both the links list and the
          account cluster, which pushed a visibly larger gap in front of "Cart"
          than between the other items. Now a single `ml-auto` sits on this
          wrapper, and one `gap` value spaces everything inside it -- so the
          rhythm is identical across the whole bar.
        */}
        <div className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClasses}>
              {link.label}
            </NavLink>
          ))}

          <NavLink
            to="/cart"
            className={navLinkClasses}
            // The count is in the accessible name, not only in a visual badge.
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

          {isAuthenticated ? (
            <>
              <NavLink to="/account" className={navLinkClasses}>
                {user?.first_name || user?.username}
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="inline-flex min-h-11 items-center rounded-full px-4 font-body text-xs uppercase tracking-[0.14em] text-faint transition-colors duration-300 hover:text-white"
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

        {/* Mobile cluster: cart + hamburger only. */}
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <NavLink
            to="/cart"
            className={navLinkClasses}
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

          <button
            ref={drawerToggleRef}
            type="button"
            onClick={() => setIsDrawerOpen((open) => !open)}
            // aria-expanded is what tells a screen reader whether the menu is
            // open; without it this is an unlabelled button.
            aria-expanded={isDrawerOpen}
            aria-controls="mobile-drawer"
            aria-label={isDrawerOpen ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <HamburgerIcon isOpen={isDrawerOpen} />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isDrawerOpen ? (
          <motion.div
            id="mobile-drawer"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fx-glass pointer-events-auto absolute inset-x-4 top-20 rounded-card p-3 md:hidden"
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
                      className="flex min-h-12 w-full items-center rounded-card px-4 font-body text-sm text-faint transition-colors hover:bg-white/5 hover:text-white"
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
 * NavLink passes `isActive` to its className render prop, which is how the
 * current page gets its pill without any component comparing pathnames itself.
 *
 * Identical padding on every item is half of what makes the spacing look even;
 * the single `gap` on the wrapper is the other half.
 */
function navLinkClasses({ isActive }) {
  return [
    "inline-flex min-h-11 items-center rounded-full px-4",
    "font-body text-xs uppercase tracking-[0.14em]",
    "transition-colors duration-300",
    isActive ? "bg-ember/15 text-ember" : "text-muted hover:text-white",
  ].join(" ");
}

function drawerLinkClasses({ isActive }) {
  return [
    "flex min-h-12 items-center rounded-card px-4 font-body text-sm transition-colors",
    isActive ? "bg-ember/15 text-ember" : "text-white hover:bg-white/5",
  ].join(" ");
}

/** Two bars that cross into an X. aria-hidden -- the button carries the label. */
function HamburgerIcon({ isOpen }) {
  const base =
    "absolute h-px w-5 bg-current transition-transform duration-300 ease-fonix";
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

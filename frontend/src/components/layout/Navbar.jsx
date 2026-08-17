import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";

import FoNixMark from "../brand/FoNixMark.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion.js";

const LINKS = [
  { to: "/store", label: "Store" },
  { to: "/ownership", label: "Ownership" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated, isStaff, user, logout } = useAuth();
  const { itemCount } = useCart();
  const drawerToggleRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const unfurl = isDesktop && !prefersReducedMotion;
  const [clipDone, setClipDone] = useState(!unfurl);

  // Close the drawer on navigation, so tapping a link does not leave the menu
  // covering the page you just opened.
  useEffect(() => setIsDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!unfurl) setClipDone(true);
  }, [unfurl]);

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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-4 md:pt-6">
      <motion.nav
        aria-label="Primary"
        initial={
          unfurl && !clipDone
            ? { clipPath: "inset(0% 87% 0% 0% round 999px)" }
            : false
        }
        animate={
          clipDone || !unfurl
            ? { clipPath: "none" }
            : { clipPath: "inset(0% 0% 0% 0% round 999px)" }
        }
        onAnimationComplete={() => setClipDone(true)}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className={`pointer-events-auto flex w-full max-w-5xl min-w-0 items-center rounded-full border shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-500 ${
          isScrolled
            ? "border-white/15 bg-[rgba(9,11,16,0.78)]"
            : "border-white/12 bg-[rgba(9,11,16,0.5)]"
        } py-1.5 pl-4 pr-1.5 md:py-2 md:pl-6 md:pr-2`}
      >
        <Link
          to="/"
          className="group flex min-w-0 shrink items-center gap-2 text-white transition-colors hover:text-ember md:gap-2.5"
          aria-label="FoNix home"
        >
          <FoNixMark className="h-4 w-auto shrink-0 transition-transform duration-500 ease-fonix group-hover:scale-110 md:h-5" />
          <span className="truncate font-heading text-sm font-bold tracking-[0.16em] md:text-base md:tracking-[0.2em]">
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
        <div className="ml-auto hidden items-center gap-1 lg:flex">
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

          {isStaff ? (
            <NavLink to="/dashboard" className={navLinkClasses}>
              Dashboard
            </NavLink>
          ) : null}

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

        {/* Mobile cluster: icon cart + hamburger. Text labels overflow a
            320px pill and html { overflow-x: hidden } then clips the right. */}
        <div className="ml-auto flex shrink-0 items-center lg:hidden">
          <NavLink
            to="/cart"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white"
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
          >
            <CartGlyph />
            {itemCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-deep px-1 font-body text-[9px] font-semibold text-white"
              >
                {itemCount}
              </span>
            ) : null}
          </NavLink>

          <button
            ref={drawerToggleRef}
            type="button"
            onClick={() => setIsDrawerOpen((open) => !open)}
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
            className="fx-glass pointer-events-auto absolute inset-x-3 top-[4.5rem] rounded-card p-3 lg:hidden"
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
              {isStaff ? (
                <li>
                  <NavLink to="/dashboard" className={drawerLinkClasses}>
                    Dashboard
                  </NavLink>
                </li>
              ) : null}
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
    "inline-flex min-h-11 items-center rounded-full px-3 lg:px-4",
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

function CartGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      focusable="false"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5.2 4.5H3"
      />
      <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
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

import { Outlet, useLocation } from "react-router-dom";

import Footer from "./Footer.jsx";
import Navbar from "./Navbar.jsx";

/**
 * The shell every page renders inside.
 *
 * Uses <Outlet/>, so the navbar and footer mount once and survive route
 * changes rather than being torn down and rebuilt on every navigation.
 */
export default function Layout() {
  const { pathname } = useLocation();

  // The homepage hero starts at the very top of the viewport with the navbar
  // floating over it. Every other page needs top padding, or its heading would
  // sit underneath the fixed pill.
  const isHome = pathname === "/";

  return (
    <>
      {/*
        Skip link. The first thing a keyboard user reaches, and it lets them
        jump past the whole navigation to the content. Visually hidden until
        focused -- sr-only alone would leave sighted keyboard users with an
        invisible focused element.
      */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ember focus:px-5 focus:py-3 focus:font-body focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Navbar />

      {/* One <main> per page, which is what a screen reader's "jump to main
          content" shortcut targets. */}
      <main id="main" className={isHome ? "" : "pt-28 md:pt-32"}>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}

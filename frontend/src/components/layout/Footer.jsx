import { Link } from "react-router-dom";

import FoNixMark from "../brand/FoNixMark.jsx";

const COLUMNS = [
  {
    heading: "Range",
    links: [
      { to: "/store", label: "All models" },
      { to: "/store/ignis", label: "Ignis" },
      { to: "/store/aurea", label: "Aurea" },
      { to: "/store/cinder", label: "Cinder" },
      { to: "/store/vesper", label: "Vesper" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/about", label: "About FoNix" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Account",
    links: [
      { to: "/account", label: "Your orders" },
      { to: "/login", label: "Sign in" },
      { to: "/register", label: "Create account" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-hairline bg-void">
      <div className="fx-container py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-3 text-white transition-colors hover:text-ember"
            >
              <FoNixMark className="h-6 w-auto" />
              <span className="font-heading text-lg font-bold tracking-[0.2em]">
                FONIX
              </span>
            </Link>
            <p className="mt-5 max-w-xs font-body text-sm leading-relaxed text-muted">
              Electric hypercars, built around the argument that restraint and
              violence are the same discipline.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-faint">
                {column.heading}
              </h2>
              <ul className="mt-5 space-y-1">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      // Generous vertical padding gives every footer link a
                      // 44px touch target without visibly spacing the list out.
                      className="inline-flex min-h-11 items-center font-body text-sm text-muted transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-hairline pt-8 md:flex-row md:items-center md:justify-between">
          <p className="font-body text-xs text-faint">
            © {new Date().getFullYear()} FoNix Automotive. A fictional marque,
            built as a portfolio project.
          </p>
          <p className="font-body text-xs text-faint">
            No vehicles are for sale. Checkout is a demonstration only.
          </p>
        </div>
      </div>
    </footer>
  );
}

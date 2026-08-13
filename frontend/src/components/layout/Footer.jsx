import { useState } from "react";
import { Link } from "react-router-dom";

import FoNixMark from "../brand/FoNixMark.jsx";
import SocialIcon from "../ui/SocialIcon.jsx";

const COLUMNS = [
  {
    heading: "The range",
    links: [
      { to: "/store", label: "All models" },
      { to: "/store/ignis", label: "Ignis" },
      { to: "/store/cinder", label: "Cinder" },
      { to: "/store/aurea", label: "Aurea" },
      { to: "/store/vesper", label: "Vesper" },
      { to: "/store/lumen", label: "Lumen" },
      { to: "/store/atlas", label: "Atlas" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/about", label: "About FoNix" },
      { to: "/about", label: "The hangar" },
      { to: "/contact", label: "Contact" },
      { to: "/contact", label: "Book a viewing" },
    ],
  },
  {
    heading: "Account",
    links: [
      { to: "/account", label: "Your orders" },
      { to: "/cart", label: "Your cart" },
      { to: "/login", label: "Sign in" },
      { to: "/register", label: "Create account" },
    ],
  },
];

const SOCIALS = [
  { name: "instagram", label: "FoNix on Instagram", href: "#" },
  { name: "youtube", label: "FoNix on YouTube", href: "#" },
  { name: "x", label: "FoNix on X", href: "#" },
  { name: "linkedin", label: "FoNix on LinkedIn", href: "#" },
  { name: "github", label: "This project on GitHub", href: "#" },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-hairline bg-void">
      {/* A single ember hairline across the very top. The one flash of accent
          in an otherwise monochrome footer, which is what stops it reading as
          a dead zone at the bottom of the page. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember/45 to-transparent"
      />

      <div className="fx-container py-12 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr] lg:gap-16">
          {/* --- Brand column --- */}
          <div>
            <Link
              to="/"
              className="group inline-flex items-center gap-3 text-white transition-colors hover:text-ember"
            >
              <FoNixMark className="h-6 w-auto transition-transform duration-500 ease-fonix group-hover:scale-110" />
              <span className="font-heading text-lg font-bold tracking-[0.2em]">
                FONIX
              </span>
            </Link>

            <p className="mt-5 max-w-xs font-body text-sm leading-relaxed text-muted">
              Electric hypercars, built on the argument that restraint and
              violence are the same discipline.
            </p>

            <address className="mt-6 not-italic font-body text-sm leading-relaxed text-faint">
              Building 4, Filton Airfield
              <br />
              Bristol BS34, United Kingdom
            </address>

            <ul className="mt-6 flex items-center gap-2">
              {SOCIALS.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.href}
                    // The links are placeholders for a fictional brand, so they
                    // must not pretend to go somewhere. aria-disabled tells
                    // assistive tech the same thing the cursor tells everyone
                    // else.
                    aria-disabled="true"
                    aria-label={`${social.label} (placeholder, FoNix is a fictional marque)`}
                    onClick={(event) => event.preventDefault()}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-muted transition-all duration-300 ease-fonix hover:-translate-y-0.5 hover:border-ember/50 hover:text-ember"
                  >
                    <SocialIcon name={social.name} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* --- Link columns ---
              On a phone these sit two-up (three-up from sm) rather than stacking
              into one very tall column, which is what made the footer run on
              forever on mobile. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-faint">
                  {column.heading}
                </h2>
                <ul className="mt-4">
                  {column.links.map((link) => (
                    <li key={link.to + link.label}>
                      <Link
                        to={link.to}
                        // Generous vertical padding gives every link a 44px touch
                        // target without visibly spacing the list out.
                        className="group inline-flex min-h-11 items-center font-body text-sm text-muted transition-colors hover:text-white"
                      >
                        <span className="relative">
                          {link.label}
                          {/* An underline that grows from the left on hover --
                              cheaper and quieter than a colour change alone. */}
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-0.5 left-0 h-px w-0 bg-ember transition-all duration-300 ease-fonix group-hover:w-full"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <NewsletterSignup />

        <div className="mt-12 flex flex-col gap-4 border-t border-hairline pt-8 md:flex-row md:items-center md:justify-between">
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

/**
 * A newsletter field that does not lie.
 *
 * There is no mailing list behind it, so it confirms locally rather than
 * posting anywhere and pretending. Building a fake form that silently discards
 * an email address would be worse than not having one.
 */
function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="mt-12 rounded-card border border-hairline bg-graphite/40 p-6 md:mt-16 md:p-8">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-10">
        <div>
          <h2 className="font-heading text-lg font-bold text-white md:text-xl">
            Hear about the next one first.
          </h2>
          <p className="mt-2 font-body text-sm text-muted">
            Occasional updates on the range. Nothing else, ever.
          </p>
        </div>

        {submitted ? (
          <p
            role="status"
            className="font-body text-sm text-ember"
          >
            Noted. This is a demo, so nothing was actually sent.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-12 flex-1 rounded-full border border-hairline bg-void/60 px-5 font-body text-sm text-white transition-colors placeholder:text-faint focus:border-white/30 focus:outline-none"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-ember-deep px-7 font-body text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:bg-ember"
            >
              Sign up
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

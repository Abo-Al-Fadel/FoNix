import { Link } from "react-router-dom";

/**
 * The site's one button.
 *
 * Every CTA renders through this so that padding, focus ring, disabled state
 * and the ember hover behaviour are identical everywhere -- which is most of
 * what stops a multi-page site looking assembled from parts.
 */

const VARIANTS = {
  // The primary action. ember-deep rather than raw ember: white text on the
  // lighter accent falls short of WCAG AA at button sizes.
  primary:
    "bg-ember-deep text-white hover:bg-ember active:bg-ember-deep border border-transparent",
  // Quiet default: a hairline that fills with glass on hover.
  ghost:
    "fx-glass text-white hover:bg-white/10 hover:border-white/20",
  // Text-only, for tertiary actions like "remove".
  bare: "text-muted hover:text-white border border-transparent",
};

const SIZES = {
  // min-h-11 is 44px -- the touch target minimum from the mobile a11y
  // guidelines, applied to every size rather than only the small one.
  sm: "min-h-11 px-4 text-xs",
  md: "min-h-11 px-6 text-sm",
  lg: "min-h-13 px-8 text-sm md:px-10",
};

function classesFor({ variant, size, fullWidth, className }) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full",
    "font-body font-medium uppercase tracking-[0.14em]",
    "transition-colors duration-300 ease-[var(--ease-fonix)]",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Renders a <button>, or a react-router <Link> when given `to`, or an <a> when
 * given `href`.
 *
 * Picking the element from the props rather than exposing an `as` prop keeps
 * call sites honest: something that navigates gets a real link -- keyboard
 * focusable, middle-clickable, readable by a screen reader as a link -- and
 * something that acts gets a real button. A <div onClick> would be neither.
 */
export default function Button({
  children,
  to,
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...rest
}) {
  const classes = classesFor({ variant, size, fullWidth, className });

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        // Only added for external links; noreferrer also covers the
        // window.opener security issue that comes with target="_blank".
        {...(rest.target === "_blank" ? { rel: "noreferrer noopener" } : {})}
        {...rest}
      >
        {children}
      </a>
    );
  }

  // Explicit type: a <button> inside a <form> defaults to type="submit", which
  // makes an unrelated button silently submit the form.
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}

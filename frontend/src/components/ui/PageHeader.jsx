/**
 * The heading block at the top of every non-home page.
 *
 * Shared so the eyebrow/title/lede rhythm is identical across Store, About,
 * Contact, Cart and Account. The homepage deliberately does not use it -- the
 * hero is the one page allowed its own typographic rules.
 */
export default function PageHeader({ eyebrow, title, lede, children }) {
  return (
    <header className="fx-container pb-12 pt-6 md:pb-16">
      {eyebrow ? <p className="fx-eyebrow">{eyebrow}</p> : null}

      {/* clamp() scales the title smoothly with the viewport instead of
          stepping between breakpoints -- it keeps the type feeling deliberate
          at every width rather than only at the three we happened to test. */}
      <h1
        className="mt-4 font-heading font-bold leading-[1.05] text-white"
        style={{ fontSize: "clamp(2.25rem, 1.4rem + 3.6vw, 4rem)" }}
      >
        {title}
      </h1>

      {lede ? (
        <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-muted">
          {lede}
        </p>
      ) : null}

      {children}
    </header>
  );
}

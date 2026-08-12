/**
 * The loading / empty / error states.
 *
 * Bundled into one file because they are the same layout with different words,
 * and because a page that handles all three consistently is what separates a
 * finished app from a demo. Every data-fetching page in this project renders
 * one of these rather than a bare "Loading..." string.
 */

/**
 * Live region wrapper.
 *
 * aria-live="polite" means a screen reader announces the change when the
 * content swaps from loading to loaded, rather than leaving someone who cannot
 * see the spinner with no idea anything happened.
 */
function Frame({ children, className = "" }) {
  return (
    <div
      className={`flex min-h-[45vh] flex-col items-center justify-center gap-4 px-6 text-center ${className}`}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export function LoadingState({ label = "Loading" }) {
  return (
    <Frame>
      {/* A slowly rotating blade rather than a generic spinner -- small, but it
          is the kind of detail that reads as considered. aria-hidden because
          the text below already announces the state. */}
      <div
        className="h-8 w-8 animate-spin rounded-sm border-2 border-hairline border-t-ember"
        style={{ animationDuration: "1.1s" }}
        aria-hidden="true"
      />
      <p className="font-body text-xs uppercase tracking-[0.28em] text-faint">
        {label}
      </p>
    </Frame>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    // role="alert" makes this interrupt and announce immediately -- an error is
    // worth breaking politeness for.
    <Frame>
      <div role="alert" className="flex flex-col items-center gap-4">
        <p className="fx-eyebrow">Something went wrong</p>
        <p className="max-w-md font-body text-sm text-muted">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-full border border-hairline px-6 font-body text-xs uppercase tracking-[0.16em] text-white transition-colors hover:border-ember hover:text-ember"
          >
            Try again
          </button>
        ) : null}
      </div>
    </Frame>
  );
}

export function EmptyState({ title, children }) {
  return (
    <Frame>
      <h2 className="font-heading text-xl text-white">{title}</h2>
      {children ? (
        <div className="max-w-md font-body text-sm text-muted">{children}</div>
      ) : null}
    </Frame>
  );
}

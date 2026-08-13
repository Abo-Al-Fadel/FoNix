import { Component } from "react";

/**
 * Catches render-time crashes so one broken component cannot blank the site.
 *
 * This exists because of a real bug: GSAP's ScrollTrigger pin inserts a wrapper
 * div that React does not know about, and unmounting the hero threw
 * "removeChild: The node to be removed is not a child of this node". React's
 * response to an uncaught error is to unmount the ENTIRE root -- so a fault in
 * one animation produced a completely white page with no explanation.
 *
 * The underlying bug is fixed (see the useLayoutEffect note in HeroSequence),
 * but the failure mode was severe enough to be worth a permanent guard.
 *
 * Still a class component: componentDidCatch has no hook equivalent. This is
 * the one place React still requires a class, and that is expected to remain
 * true for the foreseeable future.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  /** Runs during render, so the fallback UI is shown on the same commit. */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /** Runs after -- the place for logging to an error service. */
  componentDidCatch(error, info) {
    // In a deployed app this would report to Sentry or similar. Logging to the
    // console at least means the stack is not silently swallowed.
    console.error("Uncaught render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="fx-eyebrow">Something broke</p>
        <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
          This page hit an error.
        </h1>
        <p className="max-w-md font-body text-sm leading-relaxed text-muted">
          That is a bug on our side, not something you did. Reloading usually
          clears it.
        </p>

        {/* The message is genuinely useful while developing and harmless in a
            portfolio piece. A commercial app would hide it behind a check on
            import.meta.env.DEV. */}
        <pre className="max-w-xl overflow-x-auto rounded-input border border-hairline bg-graphite/60 p-4 text-left font-mono text-xs text-muted">
          {String(error?.message ?? error)}
        </pre>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="min-h-11 rounded-full bg-ember-deep px-6 font-body text-xs uppercase tracking-[0.14em] text-white transition-colors hover:bg-ember"
          >
            Back to the homepage
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="min-h-11 rounded-full border border-hairline px-6 font-body text-xs uppercase tracking-[0.14em] text-white transition-colors hover:border-ember hover:text-ember"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

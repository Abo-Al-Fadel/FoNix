import Button from "../components/ui/Button.jsx";

export default function NotFound() {
  return (
    <div className="fx-container flex min-h-[65vh] flex-col items-center justify-center pb-24 text-center">
      {/* Anton is reserved for the homepage hero, so even the 404 uses the
          heading face. Spending the display font here would dilute the one
          place it is meant to land. */}
      <p className="fx-eyebrow">404</p>
      <h1 className="mt-4 font-heading text-4xl font-bold text-white md:text-5xl">
        This road doesn’t exist.
      </h1>
      <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-muted">
        The page you were looking for isn’t here. It may have moved, or the link
        may have been mistyped.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button to="/">Back to the homepage</Button>
        <Button to="/store" variant="ghost">
          See the range
        </Button>
      </div>
    </div>
  );
}

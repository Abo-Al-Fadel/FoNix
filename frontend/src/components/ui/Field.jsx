import { useId } from "react";

/**
 * A labelled form input.
 *
 * useId generates a unique id per instance, which is what lets the <label>'s
 * htmlFor point at the input reliably even when the same field appears twice on
 * a page. Hand-written ids break the moment a component is reused.
 *
 * The label is always a real <label>, never a placeholder standing in for one:
 * placeholder text disappears the moment someone starts typing, which leaves
 * anyone using a screen reader -- or anyone who simply looked away -- with an
 * unlabelled box.
 */
export default function Field({
  label,
  type = "text",
  error,
  hint,
  className = "",
  ...rest
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // aria-describedby points the input at whichever helper text exists, so it is
  // announced together with the label rather than being invisible to
  // assistive tech.
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block font-body text-xs font-medium uppercase tracking-[0.14em] text-muted"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        aria-describedby={describedBy}
        // aria-invalid is how a screen reader knows the field is in an error
        // state; a red border alone communicates nothing to it.
        aria-invalid={error ? true : undefined}
        className={`mt-2.5 h-12 w-full rounded-input border bg-graphite/60 px-4 font-body text-sm text-white transition-colors placeholder:text-faint focus:outline-none ${
          error
            ? "border-ember"
            : "border-hairline focus:border-white/30"
        }`}
        {...rest}
      />

      {hint && !error ? (
        <p id={hintId} className="mt-2 font-body text-xs text-faint">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-2 font-body text-xs text-ember">
          {error}
        </p>
      ) : null}
    </div>
  );
}

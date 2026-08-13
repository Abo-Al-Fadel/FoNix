/**
 * Form-level error banner, for failures that are not tied to one field
 * (wrong password, server unreachable).
 *
 * role="alert" makes it announce as soon as it appears -- without it, a
 * keyboard user who submits a form and gets a silent rejection has no idea
 * anything happened.
 */
export default function FormError({ children }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="rounded-input border border-ember/40 bg-ember/10 px-4 py-3 font-body text-sm text-white"
    >
      {children}
    </p>
  );
}

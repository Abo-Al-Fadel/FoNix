import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import FormError from "../components/ui/FormError.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { signIn, isAuthenticated, isRestoring } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Where RequireAuth was sending them before it bounced them here.
  const redirectTo = location.state?.from ?? "/account";
  const passwordReset = Boolean(location.state?.passwordReset);

  // Already signed in? Don't render a login form. replace keeps the login URL
  // out of history so Back doesn't return to it.
  if (!isRestoring && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      // Clear a stale error as soon as the user starts fixing the input --
      // leaving "invalid credentials" on screen while they retype is noise.
      if (error) setError("");
    };
  }

  async function handleSubmit(event) {
    // The form is a real <form> with onSubmit, so Enter submits it and the
    // browser's own required-field validation runs first. preventDefault stops
    // the full page reload that would otherwise follow.
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await signIn(form);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(
        extractErrorMessage(caught, "That username and password did not match."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fx-container flex min-h-[70vh] items-center justify-center pb-24">
      <div className="w-full max-w-md">
        <p className="fx-eyebrow">Account</p>
        <h1 className="mt-4 font-heading text-4xl font-bold text-white">
          Sign in
        </h1>
        <p className="mt-4 font-body text-sm text-muted">
          Your orders and history live here.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
          {passwordReset ? (
            <p
              role="status"
              className="rounded-input border border-ember/40 bg-ember/10 px-4 py-3 font-body text-sm text-white"
            >
              Your password was updated. Sign in with the new one.
            </p>
          ) : null}

          <FormError>{error}</FormError>

          <Field
            label="Username"
            name="username"
            value={form.username}
            onChange={updateField("username")}
            autoComplete="username"
            required
            // Focus lands on the first field on load, so a keyboard user can
            // start typing immediately.
            autoFocus
          />

          <Field
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={updateField("password")}
            // Tells a password manager this is a login, not a signup, so it
            // offers to fill rather than to save a new entry.
            autoComplete="current-password"
            required
          />

          <p className="-mt-2 text-right font-body text-sm">
            <Link
              to="/forgot-password"
              className="text-muted underline-offset-4 hover:text-white hover:underline"
            >
              Forgot password?
            </Link>
          </p>

          {/*
            type="submit" is passed explicitly. Button defaults to
            type="button" so that a stray button inside a form cannot submit it
            by accident -- which means the one button that *should* submit has
            to say so.
          */}
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={isSubmitting}
            className="mt-2"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 font-body text-sm text-muted">
          No account yet?{" "}
          <Link
            to="/register"
            state={location.state}
            className="text-ember underline-offset-4 hover:underline"
          >
            Create one
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

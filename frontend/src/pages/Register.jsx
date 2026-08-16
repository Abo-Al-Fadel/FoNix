import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import FormError from "../components/ui/FormError.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_FORM = {
  username: "",
  email: "",
  first_name: "",
  password: "",
  password_confirm: "",
};

export default function Register() {
  const { signUp, isAuthenticated, isRestoring } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from ?? "/account";

  if (!isRestoring && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      if (error) setError("");
    };
  }

  // Checked client-side purely so the user gets the answer without a round
  // trip. The server checks it too (RegisterSerializer.validate) and that is
  // the check that counts -- this one can be bypassed by anyone with devtools.
  const passwordsMatch =
    form.password_confirm === "" || form.password === form.password_confirm;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!passwordsMatch) return;

    setIsSubmitting(true);
    setError("");

    try {
      // signUp registers and then signs in, so the user is not asked for the
      // password a third time.
      await signUp(form);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(extractErrorMessage(caught, "We could not create that account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fx-container flex min-h-[70vh] items-center justify-center pb-24">
      <div className="w-full max-w-md">
        <p className="fx-eyebrow">Account</p>
        <h1 className="mt-4 font-heading text-4xl font-bold text-white">
          Create an account
        </h1>
        <p className="mt-4 font-body text-sm text-muted">
          Needed to place an allocation. Checkout uses a demonstration card
          form; no money is taken.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
          <FormError>{error}</FormError>

          <Field
            label="Username"
            name="username"
            value={form.username}
            onChange={updateField("username")}
            autoComplete="username"
            required
            autoFocus
          />

          <Field
            label="First name"
            name="first_name"
            value={form.first_name}
            onChange={updateField("first_name")}
            autoComplete="given-name"
          />

          <Field
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={updateField("email")}
            autoComplete="email"
            required
          />

          <Field
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={updateField("password")}
            // new-password tells a password manager to offer to generate one
            // rather than autofilling an existing credential.
            autoComplete="new-password"
            hint="At least 8 characters, and not entirely numeric."
            required
          />

          <Field
            label="Confirm password"
            type="password"
            name="password_confirm"
            value={form.password_confirm}
            onChange={updateField("password_confirm")}
            autoComplete="new-password"
            error={passwordsMatch ? undefined : "The two passwords don't match."}
            required
          />

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={isSubmitting || !passwordsMatch}
            className="mt-2"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-8 font-body text-sm text-muted">
          Already registered?{" "}
          <Link
            to="/login"
            state={location.state}
            className="text-ember underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import { confirmPasswordReset } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import FormError from "../components/ui/FormError.jsx";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [form, setForm] = useState({ password: "", password_confirm: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch =
    form.password_confirm === "" || form.password === form.password_confirm;
  const linkLooksValid = Boolean(uid && token);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      if (error) setError("");
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!passwordsMatch || !linkLooksValid) return;

    setIsSubmitting(true);
    setError("");

    try {
      await confirmPasswordReset({
        uid,
        token,
        password: form.password,
        password_confirm: form.password_confirm,
      });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (caught) {
      setError(
        extractErrorMessage(
          caught,
          "This reset link is invalid or has expired.",
        ),
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
          Choose a new password
        </h1>
        <p className="mt-4 font-body text-sm text-muted">
          At least eight characters, and not entirely numeric.
        </p>

        {!linkLooksValid ? (
          <p
            role="alert"
            className="mt-10 rounded-input border border-ember/40 bg-ember/10 px-4 py-3 font-body text-sm text-white"
          >
            This reset link is incomplete. Request a new one from the sign-in
            page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
            <FormError>{error}</FormError>

            <Field
              label="New password"
              type="password"
              name="password"
              value={form.password}
              onChange={updateField("password")}
              autoComplete="new-password"
              required
              autoFocus
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
              {isSubmitting ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-8 font-body text-sm text-muted">
          <Link
            to="/forgot-password"
            className="text-ember underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}

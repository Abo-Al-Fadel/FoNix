import { useState } from "react";
import { Link } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import { requestPasswordReset } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import FormError from "../components/ui/FormError.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await requestPasswordReset(email);
      setIsSent(true);
    } catch (caught) {
      setError(
        extractErrorMessage(caught, "We could not send that message just now."),
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
          Reset password
        </h1>
        <p className="mt-4 font-body text-sm text-muted">
          Enter the email on the account. If it exists, we send a reset link.
          The reply is the same either way.
        </p>

        {isSent ? (
          <p
            role="status"
            className="mt-10 rounded-input border border-ember/40 bg-ember/10 px-4 py-3 font-body text-sm text-white"
          >
            If that account exists, we sent instructions. Check the address you
            typed — and, on this demo, the Django console.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
            <FormError>{error}</FormError>

            <Field
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError("");
              }}
              autoComplete="email"
              required
              autoFocus
            />

            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              className="mt-2"
            >
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-8 font-body text-sm text-muted">
          Remembered it?{" "}
          <Link
            to="/login"
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

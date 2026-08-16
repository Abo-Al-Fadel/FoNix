import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { extractErrorMessage } from "../api/client.js";
import { sendContactMessage } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import FormError from "../components/ui/FormError.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Contact() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const subjectFromUrl = params.get("subject") ?? "";

  const [form, setForm] = useState({
    name: user?.first_name ?? "",
    email: user?.email ?? "",
    subject: subjectFromUrl,
    message: subjectFromUrl.startsWith("Waitlist:")
      ? `Please add me to the waitlist for ${subjectFromUrl.replace(/^Waitlist:\s*/, "")}.`
      : "",
  });
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      if (error) setError("");
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSending(true);
    setError("");

    try {
      await sendContactMessage(form);
      setIsSent(true);
    } catch (caught) {
      setError(extractErrorMessage(caught, "We could not send that message."));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Contact"
        title="Talk to us."
        lede="Questions about the range, a request to visit the hangar, or anything else. Messages are stored for a human to read - no automated reply is sent."
      />

      <div className="fx-container">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div>
            {isSent ? (
              /*
                role="status" so the confirmation is announced. Replacing the
                form entirely (rather than showing a banner above it) also
                prevents a double submission by simply removing the button.
              */
              <div
                role="status"
                className="rounded-card border border-ember/40 bg-ember/10 p-8"
              >
                <p className="fx-eyebrow">Message received</p>
                <h2 className="mt-4 font-heading text-2xl font-bold text-white">
                  Thank you.
                </h2>
                <p className="mt-4 font-body text-sm leading-relaxed text-muted">
                  Your message has been recorded. In a production build this
                  would also trigger an email; here it is stored against the
                  FoNix admin for review.
                </p>
                <div className="mt-8">
                  <Button
                    onClick={() => {
                      setIsSent(false);
                      setForm((current) => ({
                        ...current,
                        subject: "",
                        message: "",
                      }));
                    }}
                    variant="ghost"
                  >
                    Send another
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <FormError>{error}</FormError>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Name"
                    name="name"
                    value={form.name}
                    onChange={updateField("name")}
                    autoComplete="name"
                    required
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
                </div>

                <Field
                  label="Subject"
                  name="subject"
                  value={form.subject}
                  onChange={updateField("subject")}
                />

                {/* A textarea rather than a Field: it needs a different element,
                    and forcing it through the input component would mean a
                    prop that changes the tag -- more indirection than it saves. */}
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block font-body text-xs font-medium uppercase tracking-[0.14em] text-muted"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={form.message}
                    onChange={updateField("message")}
                    rows={6}
                    required
                    minLength={10}
                    className="mt-2.5 w-full resize-y rounded-input border border-hairline bg-graphite/60 px-4 py-3 font-body text-sm leading-relaxed text-white transition-colors placeholder:text-faint focus:border-white/30 focus:outline-none"
                  />
                  <p className="mt-2 font-body text-xs text-faint">
                    At least a sentence, please.
                  </p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSending}
                  className="mt-2"
                >
                  {isSending ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}
          </div>

          <aside className="space-y-8">
            <div className="rounded-card border border-hairline bg-graphite/50 p-6">
              <h2 className="font-body text-xs uppercase tracking-[0.16em] text-faint">
                The hangar
              </h2>
              <p className="mt-4 font-body text-sm leading-relaxed text-muted">
                Building 4, Filton Airfield
                <br />
                Bristol BS34
                <br />
                United Kingdom
              </p>
            </div>

            <div className="rounded-card border border-hairline bg-graphite/50 p-6">
              <h2 className="font-body text-xs uppercase tracking-[0.16em] text-faint">
                A note on this form
              </h2>
              <p className="mt-4 font-body text-sm leading-relaxed text-muted">
                FoNix is a fictional marque and this address is not real. The
                form itself is: submissions are validated and persisted by the
                Django API, and rate-limited to five per hour per address.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

import LegalDocument, { LegalSection } from "./LegalDocument.jsx";

export default function Cookies() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Cookies"
      lede="The public site does not set advertising or analytics cookies. Sign-in and the cart use localStorage instead."
    >
      <LegalSection title="The React app">
        <p>
          Access and refresh tokens are stored in localStorage, not in a
          cookie. The cart is stored the same way. Clearing site data for this
          origin removes both.
        </p>
      </LegalSection>

      <LegalSection title="The Django admin">
        <p>
          If you open <code className="text-white">/admin/</code> on the API
          host, Django sets a session cookie so the admin can keep you signed
          in. That cookie is not used by the public pages.
        </p>
      </LegalSection>

      <LegalSection title="What is absent">
        <p>
          There is no marketing pixel, no A/B testing cookie, and no
          third-party script that would set one. If that changes, this page
          has to change with it.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}

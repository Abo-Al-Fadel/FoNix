import LegalDocument, { LegalSection } from "./LegalDocument.jsx";

export default function Privacy() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy"
      lede="FoNix is a fictional marque and a portfolio project. This page describes what the demo actually stores, not what a real manufacturer would."
    >
      <LegalSection title="Who this is">
        <p>
          The site is a demonstration. There is no FoNix company, no showroom,
          and no vehicles for sale. If you create an account or send a message
          here, you are talking to a project database, not a business.
        </p>
      </LegalSection>

      <LegalSection title="What is stored">
        <p>An account keeps a username, email address, name, role, and a hashed password. The password itself is never stored.</p>
        <p>An order keeps the cars, quantities, and the prices the server read at the time — not a price the browser suggested.</p>
        <p>The contact form keeps your name, email, subject and message so they can be read in the Django admin. There is no automated reply.</p>
      </LegalSection>

      <LegalSection title="What is not stored">
        <p>
          There are no card numbers, no shipping addresses, and no analytics
          vendors. Checkout does not take payment. The cart lives in your
          browser until you place an order.
        </p>
      </LegalSection>

      <LegalSection title="Who can see it">
        <p>
          You can read your own account and your own orders. FoNix staff
          accounts on this demo can read every order and every contact
          message. That is the point of the control panel; it is also why
          you should not put real personal data into a public demo.
        </p>
      </LegalSection>

      <LegalSection title="Tokens">
        <p>
          Sign-in tokens are kept in your browser&apos;s localStorage so the
          React app can call the API. They are not httpOnly cookies. Clearing
          site data signs you out.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}

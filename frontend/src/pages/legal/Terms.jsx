import LegalDocument, { LegalSection } from "./LegalDocument.jsx";

export default function Terms() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms"
      lede="This is a portfolio project that looks like a car maker. It is not one."
    >
      <LegalSection title="No sale">
        <p>
          Nothing on this site is for sale. Model names, prices, specifications
          and photography are invented or generated for the demonstration.
          Placing an order records a row in a database. It does not create a
          contract, a reservation, or a delivery.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You may register so the control panel and order history can be
          demonstrated. Do not use a password you use anywhere else. Demo staff
          accounts published in the repository are for local development only
          and are refused in production.
        </p>
      </LegalSection>

      <LegalSection title="Content">
        <p>
          The FoNix name, wordmark and copy on this site belong to the project.
          They are not a real trademark. Do not treat them as one.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}

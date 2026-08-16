import PageHeader from "../../components/ui/PageHeader.jsx";

export default function LegalDocument({ eyebrow, title, lede, children }) {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="fx-container">
        <div className="max-w-2xl space-y-8 font-body text-sm leading-relaxed text-muted">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="font-heading text-lg font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

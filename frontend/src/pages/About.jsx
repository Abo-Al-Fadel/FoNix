import Button from "../components/ui/Button.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import FoNixMark from "../components/brand/FoNixMark.jsx";

const PRINCIPLES = [
  {
    number: "01",
    title: "Subtract, then subtract again",
    body: "Every FoNix begins as a list of parts we are trying to delete. The Ignis has no gearbox, no driveshaft, no exhaust and no grille — and its silhouette is the shape that is left when all of those stop mattering.",
  },
  {
    number: "02",
    title: "One line, uninterrupted",
    body: "The light blade that runs from the front splitter to the rear diffuser is a single unbroken element. It is difficult to tool, expensive to align and impossible to unsee. That is the whole argument.",
  },
  {
    number: "03",
    title: "Quiet is the point",
    body: "We do not synthesise an engine note. A FoNix at full throttle makes the sound of air being moved out of the way, and nothing else. Everyone who has driven one has said the same thing about the silence.",
  },
];

export default function About() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="The marque"
        title="Named for the thing that comes back."
        lede="FoNix builds four electric cars in a converted aircraft hangar outside Bristol. The name is a deliberate misspelling — the phoenix, but engineered."
      />

      <div className="fx-container">
        {/* The one place outside the hero where the mark is shown at scale.
            Decorative, so no accessible name -- the heading beside it carries
            the meaning. */}
        <section className="grid items-center gap-12 border-y border-hairline py-16 md:grid-cols-[auto_1fr] md:gap-16 md:py-20">
          <FoNixMark className="h-24 w-auto text-white/10 md:h-40" />
          <div>
            <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
              A brand invented so nothing had to be borrowed.
            </h2>
            <p className="mt-5 max-w-2xl font-body text-sm leading-relaxed text-muted md:text-base">
              FoNix is fictional. It exists because putting a real
              manufacturer’s trademarked name and design language on a public
              portfolio site is somebody else’s intellectual property, not a
              demonstration of anything. Inventing a marque meant the identity,
              the copy, the palette and the logo could all be built from
              nothing — which is the part actually worth showing.
            </p>
          </div>
        </section>

        <section className="fx-section">
          <p className="fx-eyebrow">How we build</p>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {PRINCIPLES.map((principle) => (
              <article key={principle.number}>
                <p className="font-heading text-5xl font-bold text-white/10">
                  {principle.number}
                </p>
                <h3 className="mt-4 font-heading text-lg font-bold text-white">
                  {principle.title}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                  {principle.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-hairline bg-graphite/50 p-8 md:p-12">
          <p className="fx-eyebrow">About this build</p>
          <h2 className="mt-4 font-heading text-2xl font-bold text-white md:text-3xl">
            What is actually running here
          </h2>
          <div className="mt-6 grid gap-8 font-body text-sm leading-relaxed text-muted md:grid-cols-2">
            <div>
              <p>
                The catalog, accounts and orders are served by a Django REST
                Framework API with JWT authentication and a PostgreSQL-ready
                schema. Permissions are enforced server-side: the store is
                public to read, and only staff accounts can change it.
              </p>
              <p className="mt-4">
                The cart lives in the browser until checkout, at which point the
                whole thing is posted in one request and becomes an order with
                its line items — with prices read from the database, never from
                the request.
              </p>
            </div>
            <div>
              <p>
                The front end is React and Vite, styled with Tailwind against a
                fixed set of design tokens. The homepage sequence is a real
                video for its first beat and a scroll-scrubbed frame sequence
                after it, and it steps aside entirely if your system asks for
                reduced motion.
              </p>
              <p className="mt-4">
                Payment processing, deployment and a server-side cart are
                deliberately out of scope rather than half-built.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button to="/store">See the range</Button>
            <Button to="/contact" variant="ghost">
              Get in touch
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

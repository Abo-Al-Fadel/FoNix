import Button from "../components/ui/Button.jsx";
import FoNixMark from "../components/brand/FoNixMark.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Reveal, { RevealGroup, RevealItem } from "../components/ui/Reveal.jsx";

const DISCIPLINES = [
  {
    title: "Structures",
    body: "Every FoNix uses a bonded carbon monocoque with the battery as a stressed member. The pack is not a box bolted underneath, and it is part of what makes the car stiff.",
  },
  {
    title: "Thermal",
    body: "The hardest problem in an electric hypercar is not going fast once. It is going fast for twenty minutes. Our cooling loop is sized for a race distance, not a magazine sprint.",
  },
  {
    title: "Software",
    body: "Torque is arbitrated across four motors a thousand times a second. The car decides which wheel gets what before you have finished turning the wheel.",
  },
  {
    title: "Interior",
    body: "One billet of aluminium, milled. No trim, no seams, no plastic pretending to be metal. It costs more and takes longer and we have not found a reason to stop.",
  },
];

const FACTS = [
  { label: "Founded", value: "2019" },
  { label: "Location", value: "Bristol, UK" },
  { label: "People", value: "94" },
  { label: "Cars built", value: "312" },
];

export default function About() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="The marque"
        title="Named for the thing that comes back."
        lede="FoNix builds six electric cars in a converted aircraft hangar outside Bristol. The name is a deliberate misspelling: the phoenix, but engineered."
      />

      <div className="fx-container">
        {/* --- Facts strip --- */}
        <Reveal>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hairline bg-hairline md:grid-cols-4">
            {FACTS.map((fact) => (
              <div key={fact.label} className="bg-void px-5 py-6">
                <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-faint">
                  {fact.label}
                </dt>
                <dd className="mt-2 font-heading text-xl font-bold text-white md:text-2xl">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* --- Atmospheric hangar band --- */}
        <Reveal className="mt-12">
          <figure className="fx-sheen overflow-hidden rounded-card border border-hairline">
            <img
              src="/brand/hangar.webp"
              alt="The interior of the converted aircraft hangar outside Bristol where FoNix builds, a single car under a pool of overhead light in a vast dark space."
              width={1600}
              height={900}
              loading="lazy"
              className="aspect-video w-full object-cover"
            />
          </figure>
        </Reveal>

        {/* --- Why fictional --- */}
        <section className="fx-section border-b border-hairline">
          <div className="grid items-center gap-12 md:grid-cols-[auto_1fr] md:gap-16">
            <Reveal direction="right">
              {/* The one place outside the hero where the mark appears at scale.
                  Decorative, so the heading beside it carries the meaning. */}
              <FoNixMark className="h-24 w-auto text-white/10 md:h-44" />
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
                A brand invented so nothing had to be borrowed.
              </h2>
              <p className="mt-5 max-w-2xl font-body text-sm leading-relaxed text-muted md:text-base">
                FoNix is fictional. It exists because putting a real
                manufacturer’s trademarked name and design language on a public
                portfolio site is somebody else’s intellectual property, not a
                demonstration of anything.
              </p>
              <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-muted md:text-base">
                Inventing a marque meant the identity, the copy, the palette and
                the logo could all be built from nothing, which is the part
                actually worth showing.
              </p>
            </Reveal>
          </div>
        </section>

        {/* --- Disciplines --- */}
        <section className="fx-section">
          <Reveal>
            <p className="fx-eyebrow">Four disciplines</p>
            <h2 className="mt-4 font-heading text-2xl font-bold text-white md:text-3xl">
              What we actually argue about
            </h2>
          </Reveal>

          <RevealGroup className="mt-12 grid gap-px overflow-hidden rounded-card border border-hairline bg-hairline md:grid-cols-2">
            {DISCIPLINES.map((discipline) => (
              <RevealItem
                key={discipline.title}
                className="group bg-void p-7 transition-colors duration-500 hover:bg-graphite/50 md:p-9"
              >
                <h3 className="font-heading text-lg font-bold text-white">
                  {discipline.title}
                </h3>
                <span
                  aria-hidden="true"
                  className="mt-3 block h-px w-10 bg-ember/40 transition-all duration-500 ease-fonix group-hover:w-20"
                />
                <p className="mt-4 font-body text-sm leading-relaxed text-muted">
                  {discipline.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* --- About this build --- */}
        <Reveal>
          <section className="rounded-card border border-hairline bg-graphite/40 p-8 md:p-12">
            <p className="fx-eyebrow">About this build</p>
            <h2 className="mt-4 font-heading text-2xl font-bold text-white md:text-3xl">
              What is actually running here
            </h2>

            <div className="mt-8 grid gap-8 font-body text-sm leading-relaxed text-muted md:grid-cols-2 md:gap-12">
              <div>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-white">
                  Backend
                </h3>
                <p className="mt-3">
                  A Django REST Framework API with JWT authentication and a
                  PostgreSQL-ready schema. Permissions are enforced server-side:
                  the store is public to read, and only staff accounts can change
                  it.
                </p>
                <p className="mt-4">
                  The cart lives in the browser until checkout, at which point
                  the whole thing is posted in one request and becomes an order
                  with its line items, with prices read from the database, never
                  from the request.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-white">
                  Frontend
                </h3>
                <p className="mt-3">
                  React and Vite, styled with Tailwind against a fixed set of
                  design tokens. The homepage sequence is a real video for its
                  first beat and a scroll-scrubbed frame sequence after it.
                </p>
                <p className="mt-4">
                  It steps aside entirely if your system asks for reduced motion,
                  and serves a frame set 88% smaller on a phone. Payment
                  processing and deployment are deliberately out of scope rather
                  than half-built.
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
        </Reveal>
      </div>
    </div>
  );
}

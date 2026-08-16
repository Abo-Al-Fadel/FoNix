import PageHeader from "../components/ui/PageHeader.jsx";
import Reveal, { RevealGroup, RevealItem } from "../components/ui/Reveal.jsx";

const STAGES = [
  {
    title: "Configure",
    body: "One car, specified. Paint, interior and wheels are locked to the allocation. Quantity is one because a FoNix is a build slot, not a crate of stock.",
  },
  {
    title: "Reserve",
    body: "A 10% demonstration reservation holds the slot. Marques that sell online work the same way: a deposit now, the balance when the hangar confirms. Here the card form is a replica. No money leaves the card.",
  },
  {
    title: "Confirm",
    body: "Hangar admin reviews the allocation. Until that happens you can cancel from your account and the slot returns to the range. After confirmation, only the hangar can unwind it.",
  },
  {
    title: "Build",
    body: "Lead time is on the spec sheet. Status moves through production and transit. You will see each step on your orders page.",
  },
  {
    title: "Handover",
    body: "Collect at Building 4, Filton Airfield, or take delivery. Warranty and the first service interval start on that day.",
  },
];

const COVER = [
  {
    title: "Warranty",
    body: "Four years on the vehicle, eight on the high-voltage battery, unless the model sheet says otherwise. Wear items and track use are excluded. The hangar is the only authorised service point in this demonstration.",
  },
  {
    title: "Service",
    body: "Interval is printed on each model's specification. Book through Contact. There is no dealer network: FoNix is hangar-direct, the way Tesla sells cars and the way a small marque has to.",
  },
  {
    title: "Software",
    body: "Powertrain maps update over the air. A reserved car stays on the build of the day it was allocated unless you ask the hangar to freeze it.",
  },
];

export default function Ownership() {
  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="Ownership"
        title="After the slot is yours."
        lede="FoNix sells the way a modern marque does: configure online, reserve a build, collect at the hangar. What follows is warranty, service, and the car you actually specified."
      />

      <div className="fx-container">
        <Reveal>
          <ol className="grid list-none gap-px overflow-hidden rounded-card border border-hairline bg-hairline md:grid-cols-5">
            {STAGES.map((stage, index) => (
              <li key={stage.title} className="bg-void p-5 md:p-6">
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-ember">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 font-heading text-lg font-bold text-white">
                  {stage.title}
                </h2>
                <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                  {stage.body}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-4 md:grid-cols-3">
          {COVER.map((item) => (
            <RevealItem key={item.title}>
              <article className="h-full rounded-card border border-hairline bg-graphite/50 p-6">
                <h2 className="font-heading text-lg font-bold text-white">
                  {item.title}
                </h2>
                <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-12 max-w-2xl">
          <p className="font-body text-sm leading-relaxed text-faint">
            This page is part of a portfolio demonstration. Nothing here is a
            contract, an insurance product, or a real warranty. The process is
            written to match how limited-run marques actually take orders
            online — reservation, confirmation, build — not a supermarket
            checkout.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

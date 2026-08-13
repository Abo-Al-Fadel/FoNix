import { useCallback } from "react";

import { fetchCars } from "../api/endpoints.js";
import HeroSequence from "../components/hero/HeroSequence.jsx";
import CarCard from "../components/store/CarCard.jsx";
import AnimatedNumber from "../components/ui/AnimatedNumber.jsx";
import Button from "../components/ui/Button.jsx";
import Reveal, { RevealGroup, RevealItem } from "../components/ui/Reveal.jsx";
import useApiResource from "../hooks/useApiResource.js";

const NUMBERS = [
  { value: 412, decimals: 0, unit: "km/h", label: "Top speed, Ignis" },
  { value: 2.1, decimals: 1, unit: "s", label: "0–100 km/h" },
  { value: 1847, decimals: 0, unit: "kW", label: "Combined output" },
  { value: 6, decimals: 0, unit: "", label: "Cars in the range" },
];

const PRINCIPLES = [
  {
    number: "01",
    title: "Subtract, then subtract again",
    body: "Every FoNix begins as a list of parts we are trying to delete. No gearbox, no driveshaft, no exhaust, no grille. The silhouette is simply what is left once none of those matter.",
  },
  {
    number: "02",
    title: "One line, uninterrupted",
    body: "The light blade runs from the front splitter to the rear diffuser as a single unbroken element. Difficult to tool, expensive to align, and impossible to unsee.",
  },
  {
    number: "03",
    title: "Quiet is the point",
    body: "We do not synthesise an engine note. A FoNix at full throttle makes the sound of air being moved out of the way, and nothing else.",
  },
];

const TIMELINE = [
  { year: "2019", event: "Four engineers lease half an aircraft hangar outside Bristol." },
  { year: "2021", event: "The quad-motor torque platform runs for the first time, on a bench." },
  { year: "2023", event: "Ignis prototype 001 completes its first full lap under its own power." },
  { year: "2026", event: "Six models. The hangar is now the whole building." },
];

export default function Home() {
  const fetcher = useCallback(() => fetchCars(), []);
  const { data: cars } = useApiResource(fetcher);

  // A failed fetch degrades to simply not rendering the strip. The hero and
  // everything else still work, which beats an error on the landing page.
  const featured = cars?.slice(0, 3) ?? [];

  return (
    <>
      <HeroSequence />

      {/* --- Numbers strip --- */}
      <section className="fx-band relative overflow-hidden py-16 md:py-24">
        {/* Two glows placed behind the band give it a light source. Decorative,
            so aria-hidden and pulled out of the flow entirely. */}
        <div
          aria-hidden="true"
          className="fx-glow fx-glow-ember -left-40 top-0 h-72 w-[34rem]"
        />
        <div
          aria-hidden="true"
          className="fx-glow fx-glow-cold -right-40 bottom-0 h-64 w-[30rem]"
        />

        <div className="fx-container">
          <RevealGroup className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-6">
            {NUMBERS.map((item) => (
              <RevealItem key={item.label} className="group">
                <p className="font-heading text-4xl font-bold leading-none text-ice md:text-6xl">
                  <AnimatedNumber
                    value={item.value}
                    decimals={item.decimals}
                  />
                  {item.unit ? (
                    <span className="ml-1.5 font-body text-sm font-normal text-faint md:text-base">
                      {item.unit}
                    </span>
                  ) : null}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-4 block h-px w-8 bg-ember/50 transition-all duration-700 ease-fonix group-hover:w-16"
                />
                <p className="mt-4 font-body text-[11px] uppercase tracking-[0.18em] text-faint">
                  {item.label}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* --- Brand statement --- */}
      <section className="fx-section">
        <div className="fx-container">
          <Reveal className="max-w-4xl">
            <p className="fx-eyebrow">The marque</p>
            <h2
              className="mt-6 font-heading font-bold leading-[1.08] text-white"
              style={{ fontSize: "clamp(1.75rem, 1rem + 3.2vw, 3.5rem)" }}
            >
              Six electric cars, built on the argument that restraint and
              violence are the same discipline.
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-14">
            <Reveal delay={0.08}>
              <p className="font-body text-base leading-relaxed text-muted">
                FoNix builds in a converted aircraft hangar outside Bristol.
                Every car starts as a list of parts we are trying to delete, and what survives that process is the car.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="font-body text-base leading-relaxed text-muted">
                We do not build variants. Each of the six exists because it
                answers a question the other five could not, and the day one
                stops doing that is the day it leaves the range.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="mt-10">
            <Button to="/about" variant="ghost">
              About FoNix
            </Button>
          </Reveal>
        </div>
      </section>

      {/* --- Principles --- */}
      {/* fx-band lifts alternating sections one step out of the page black and
          fades both edges, so the rhythm comes from tonal change rather than a
          stack of 1px rules. */}
      <section className="fx-band fx-section relative overflow-hidden">
        <div className="fx-container">
          <Reveal>
            <p className="fx-eyebrow">How we build</p>
          </Reveal>

          <RevealGroup className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {PRINCIPLES.map((principle) => (
              <RevealItem
                key={principle.number}
                className="group rounded-card border border-hairline bg-graphite/30 p-7 transition-colors duration-500 hover:border-white/20"
              >
                <p className="font-heading text-5xl font-bold text-white/10 transition-colors duration-500 group-hover:text-ember/25">
                  {principle.number}
                </p>
                <h3 className="mt-4 font-heading text-lg font-bold text-white">
                  {principle.title}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                  {principle.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* --- Featured range --- */}
      {featured.length > 0 ? (
        <section className="fx-section">
          <div className="fx-container">
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="fx-eyebrow">The range</p>
                <h2 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">
                  Start here.
                </h2>
              </div>
              <Button to="/store" variant="ghost">
                All six models
              </Button>
            </Reveal>

            <RevealGroup className="mt-12 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {featured.map((car) => (
                <RevealItem key={car.slug} className="flex">
                  <CarCard car={car} />
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>
      ) : null}

      {/* --- Timeline --- */}
      <section className="fx-band fx-section relative overflow-hidden">
        <div className="fx-container">
          <Reveal>
            <p className="fx-eyebrow">Since 2019</p>
            <h2 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">
              Seven years, one building.
            </h2>
          </Reveal>

          <RevealGroup className="mt-12">
            {TIMELINE.map((entry) => (
              <RevealItem
                key={entry.year}
                className="group grid grid-cols-[auto_1fr] items-baseline gap-6 border-t border-hairline py-6 transition-colors duration-500 hover:border-white/25 md:grid-cols-[8rem_1fr] md:gap-10 md:py-8"
              >
                <span className="font-heading text-lg font-bold text-ember md:text-2xl">
                  {entry.year}
                </span>
                <span className="font-body text-sm leading-relaxed text-muted transition-colors duration-500 group-hover:text-white md:text-base">
                  {entry.event}
                </span>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* --- Closing CTA --- */}
      <section className="fx-section relative overflow-hidden">
        <div
          aria-hidden="true"
          className="fx-glow fx-glow-ember left-1/2 top-1/4 h-80 w-[40rem] -translate-x-1/2"
        />
        <div className="fx-container">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="fx-eyebrow">Enquiries</p>
            <h2
              className="mt-6 font-heading font-bold leading-[1.08] text-white"
              style={{ fontSize: "clamp(1.75rem, 1rem + 2.8vw, 3rem)" }}
            >
              Come and stand next to one.
            </h2>
            <p className="mx-auto mt-6 max-w-xl font-body text-base leading-relaxed text-muted">
              The hangar is open by appointment. Tell us which car you want to
              see and we will make sure it is out of the workshop.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button to="/contact">Arrange a visit</Button>
              <Button to="/store" variant="ghost">
                See the range
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

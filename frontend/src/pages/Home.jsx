import { useCallback } from "react";
import { motion } from "framer-motion";

import { fetchCars } from "../api/endpoints.js";
import HeroSequence from "../components/hero/HeroSequence.jsx";
import CarCard from "../components/store/CarCard.jsx";
import Button from "../components/ui/Button.jsx";
import useApiResource from "../hooks/useApiResource.js";

/**
 * Shared reveal for the sections below the hero.
 *
 * Deliberately restrained: a short fade and an 18px rise, once, on entry. The
 * hero is the site's one maximalist moment, and a page full of competing
 * animation underneath it would cancel both out.
 *
 * The global prefers-reduced-motion rule in index.css collapses these
 * durations to ~0, so a reduced-motion visitor sees the content in place.
 */
const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  // once: true -- re-animating every time a section scrolls back into view is
  // the single most irritating thing a scroll animation can do.
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

export default function Home() {
  const fetcher = useCallback(() => fetchCars(), []);
  const { data: cars } = useApiResource(fetcher);

  // The homepage strip shows three models. A failed fetch here degrades to
  // simply not rendering the strip -- the hero and everything else still work,
  // which is better than an error message on the landing page.
  const featured = cars?.slice(0, 3) ?? [];

  return (
    <>
      <HeroSequence />

      {/* --- Brand statement --- */}
      <section className="fx-section border-t border-hairline">
        <div className="fx-container">
          <motion.div {...reveal} className="max-w-4xl">
            <p className="fx-eyebrow">The marque</p>
            <h2
              className="mt-6 font-heading font-bold leading-[1.08] text-white"
              style={{ fontSize: "clamp(1.75rem, 1rem + 3.2vw, 3.5rem)" }}
            >
              Four electric cars, built on the argument that restraint and
              violence are the same discipline.
            </h2>
            <p className="mt-8 max-w-2xl font-body text-base leading-relaxed text-muted">
              FoNix builds in a converted aircraft hangar outside Bristol. Every
              car starts as a list of parts we are trying to delete — and what
              survives that process is the car.
            </p>
            <div className="mt-10">
              <Button to="/about" variant="ghost">
                About FoNix
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- Featured range --- */}
      {featured.length > 0 ? (
        <section className="fx-section border-t border-hairline">
          <div className="fx-container">
            <motion.div
              {...reveal}
              className="flex flex-wrap items-end justify-between gap-6"
            >
              <div>
                <p className="fx-eyebrow">The range</p>
                <h2 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">
                  Start here.
                </h2>
              </div>
              <Button to="/store" variant="ghost">
                All models
              </Button>
            </motion.div>

            <motion.ul
              {...reveal}
              className="mt-12 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7"
            >
              {featured.map((car) => (
                <li key={car.slug} className="flex">
                  <CarCard car={car} />
                </li>
              ))}
            </motion.ul>
          </div>
        </section>
      ) : null}

      {/* --- Closing CTA --- */}
      <section className="fx-section border-t border-hairline">
        <div className="fx-container">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="fx-eyebrow">Enquiries</p>
            <h2 className="mt-6 font-heading text-3xl font-bold text-white md:text-4xl">
              Come and see one in person.
            </h2>
            <p className="mt-6 font-body text-base leading-relaxed text-muted">
              The hangar is open by appointment. Tell us which car you want to
              stand next to.
            </p>
            <div className="mt-10">
              <Button to="/contact">Arrange a visit</Button>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}

import { useCallback, useMemo, useState } from "react";

import { fetchCars } from "../api/endpoints.js";
import CarCard from "../components/store/CarCard.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Reveal, { RevealGroup, RevealItem } from "../components/ui/Reveal.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/ui/StateBlock.jsx";
import useApiResource from "../hooks/useApiResource.js";
import { formatPrice } from "../lib/format.js";

/**
 * Client-side filters.
 *
 * Deliberately not server-side query params: the whole catalog is six models
 * and already in memory, so filtering here is instant and costs no request.
 * A catalog of six hundred would need `?ordering=` on the API instead.
 */
const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price ↑" },
  { id: "price-desc", label: "Price ↓" },
  { id: "fastest", label: "Fastest" },
  { id: "range", label: "Longest range" },
];

const ORDERING_STEPS = [
  {
    number: "01",
    title: "Choose your car",
    body: "Every model is configurable to order. What you see here is the base specification and its price before options.",
  },
  {
    number: "02",
    title: "Place a reservation",
    body: "Checkout records your order against your account. No payment is taken and no card details are ever collected.",
  },
  {
    number: "03",
    title: "Build slot confirmed",
    body: "A member of the team would normally contact you to specify paint, trim and delivery. This is where a real store would take over.",
  },
];

export default function Store() {
  const fetcher = useCallback(() => fetchCars(), []);
  const { data: cars, error, isLoading, retry } = useApiResource(fetcher);
  const [sort, setSort] = useState("featured");

  // useMemo so the array is only re-sorted when the data or the sort changes,
  // not on every unrelated render.
  const sortedCars = useMemo(() => {
    if (!cars) return null;
    const copy = [...cars]; // never sort the array from state in place

    switch (sort) {
      case "price-asc":
        return copy.sort((a, b) => Number(a.base_price) - Number(b.base_price));
      case "price-desc":
        return copy.sort((a, b) => Number(b.base_price) - Number(a.base_price));
      case "fastest":
        return copy.sort(
          (a, b) => Number(a.acceleration_0_100) - Number(b.acceleration_0_100),
        );
      case "range":
        return copy.sort((a, b) => b.range_km - a.range_km);
      default:
        return copy; // the API's own ordering: hero first, then newest
    }
  }, [cars, sort]);

  const priceFloor = useMemo(() => {
    if (!cars?.length) return null;
    return Math.min(...cars.map((car) => Number(car.base_price)));
  }, [cars]);

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="The range"
        title="Six cars. One argument."
        lede="Every FoNix starts from the same premise: that the fastest way through a corner and the most restrained way to draw a car are the same problem. Here is where that has taken us so far."
      />

      <div className="fx-container">
        {/* --- Range summary strip --- */}
        {cars?.length ? (
          <Reveal>
            <dl className="mb-12 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hairline bg-hairline md:grid-cols-4">
              {[
                { label: "Models", value: cars.length },
                { label: "From", value: formatPrice(priceFloor) },
                {
                  label: "Fastest 0–100",
                  value: `${Math.min(
                    ...cars.map((c) => Number(c.acceleration_0_100)),
                  )}s`,
                },
                {
                  label: "Longest range",
                  value: `${Math.max(...cars.map((c) => c.range_km))} km`,
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-void px-5 py-6">
                  <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-faint">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 font-heading text-xl font-bold text-white md:text-2xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}

        {/* --- Sort controls --- */}
        {cars?.length ? (
          <Reveal className="mb-10">
            <div
              role="group"
              aria-label="Sort the range"
              className="flex flex-wrap items-center gap-2"
            >
              <span className="mr-2 font-body text-[10px] uppercase tracking-[0.18em] text-faint">
                Sort
              </span>
              {SORTS.map((option) => {
                const active = sort === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSort(option.id)}
                    // aria-pressed conveys the toggle state to a screen reader;
                    // the ember pill only conveys it visually.
                    aria-pressed={active}
                    className={`min-h-11 rounded-full border px-5 font-body text-xs uppercase tracking-[0.12em] transition-colors duration-300 ${
                      active
                        ? "border-ember/50 bg-ember/15 text-ember"
                        : "border-hairline text-muted hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Reveal>
        ) : null}

        {isLoading ? <LoadingState label="Loading the range" /> : null}
        {error ? <ErrorState message={error} onRetry={retry} /> : null}

        {cars && cars.length === 0 ? (
          <EmptyState title="The range is empty">
            No models have been published yet. If you are running this locally,
            seed the catalog with{" "}
            <code className="text-white">python manage.py seed_catalog</code>.
          </EmptyState>
        ) : null}

        {sortedCars && sortedCars.length > 0 ? (
          <>
            {/*
              key={sort} remounts the group when the ordering changes, which
              replays the stagger. Without it the cards silently reshuffle and
              the change is easy to miss.
            */}
            <RevealGroup
              key={sort}
              className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7"
            >
              {sortedCars.map((car) => (
                <RevealItem key={car.slug} className="flex">
                  <CarCard car={car} />
                </RevealItem>
              ))}
            </RevealGroup>
          </>
        ) : null}

        {/* --- How ordering works --- */}
        <section className="fx-section mt-8 border-t border-hairline">
          <Reveal>
            <p className="fx-eyebrow">Ordering</p>
            <h2 className="mt-4 font-heading text-2xl font-bold text-white md:text-3xl">
              How this works
            </h2>
          </Reveal>

          <RevealGroup className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {ORDERING_STEPS.map((step) => (
              <RevealItem key={step.number}>
                <p className="font-heading text-4xl font-bold text-white/10">
                  {step.number}
                </p>
                <h3 className="mt-4 font-heading text-lg font-bold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      </div>
    </div>
  );
}

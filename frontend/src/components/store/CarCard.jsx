import { Link } from "react-router-dom";

import { formatPrice, headlineSpecs } from "../../lib/format.js";

/**
 * A catalog card.
 *
 * The whole card is one <Link> rather than a div with a button inside it. That
 * gives the entire surface a single tab stop and one announcement to a screen
 * reader, instead of a card that has to be tabbed through in pieces.
 */
export default function CarCard({ car }) {
  const specs = headlineSpecs(car);

  return (
    /*
      w-full so the card fills its grid cell; flex-col here plus flex-1 on the
      body is what lets the price row sit flush at the bottom of every card
      regardless of how long the tagline runs.
    */
    <Link
      to={`/store/${car.slug}`}
      className="fx-sheen group relative flex w-full flex-col overflow-hidden rounded-3xl border border-hairline bg-graphite/70 transition-all duration-500 ease-fonix hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
    >
      <div className="relative aspect-16/9 overflow-hidden bg-void">
        {/*
          alt comes from the database (CarModel.thumbnail_alt), written by
          whoever uploaded the image -- a string generated here would describe
          every car identically and help nobody.

          loading="lazy" keeps below-the-fold cards off the critical path, and
          the explicit width/height reserve the aspect ratio so the grid does
          not jump as images arrive.
        */}
        <img
          src={car.thumbnail}
          alt={car.thumbnail_alt}
          loading="lazy"
          width={1600}
          height={900}
          className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-fonix)] group-hover:scale-[1.04]"
        />

        {/* Honesty badge. Models without photography get generated brand
            artwork rather than a reused photo of a different car, and this says
            so plainly instead of leaving a visitor to wonder. */}
        {!car.has_real_imagery ? (
          <span className="fx-glass absolute left-4 top-4 rounded-full px-3 py-1.5 font-body text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            Visualisation pending
          </span>
        ) : null}

        {car.is_hero ? (
          /* ember-deep, not ember: white text this small on the lighter accent
             only reaches ~3.5:1, short of the 4.5:1 WCAG AA needs. */
          <span className="absolute right-4 top-4 rounded-full bg-ember-deep px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
            Flagship
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-7">
        <h2 className="font-heading text-xl font-bold text-white md:text-2xl">
          {car.name}
        </h2>
        {car.tagline ? (
          <p className="mt-1.5 font-body text-sm text-muted">{car.tagline}</p>
        ) : null}

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-hairline pt-5">
          {specs.map((spec) => (
            <div key={spec.label}>
              <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                {spec.label}
              </dt>
              <dd className="mt-1 font-heading text-base font-semibold text-white">
                {spec.value}
                <span className="ml-1 font-body text-[11px] font-normal text-faint">
                  {spec.unit}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        {/* mt-auto pins the price row to the bottom, so cards with a one-line
            tagline and cards with a two-line one still align across the grid. */}
        <div className="mt-auto flex items-end justify-between pt-7">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
              From
            </p>
            <p className="mt-1 font-heading text-lg font-bold text-white">
              {formatPrice(car.base_price)}
            </p>
          </div>
          <span className="font-body text-xs uppercase tracking-[0.14em] text-muted transition-colors duration-300 group-hover:text-ember">
            Explore
            <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-500 ease-[var(--ease-fonix)] group-hover:translate-x-1">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchCar } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import { ErrorState, LoadingState } from "../components/ui/StateBlock.jsx";
import { useCart } from "../context/CartContext.jsx";
import useApiResource from "../hooks/useApiResource.js";
import usePageTitle from "../hooks/usePageTitle.js";
import {
  formatPrice,
  formatPriceDelta,
  headlineSpecs,
  specSheet,
} from "../lib/format.js";
import { titleForPath } from "../lib/pageTitle.js";

const OPTION_LABELS = {
  paint: "Paint",
  interior: "Interior",
  wheels: "Wheels",
};

export default function ProductDetail() {
  const { slug } = useParams();
  const { addItem, lines } = useCart();

  const fetcher = useCallback(() => fetchCar(slug, { publicOnly: true }), [slug]);
  const { data: car, error, isLoading, retry } = useApiResource(fetcher);
  usePageTitle(car?.name ? `${car.name} | FoNix` : titleForPath(`/store/${slug}`));

  const [activeImage, setActiveImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [selected, setSelected] = useState({});

  useEffect(() => setActiveImage(0), [slug]);

  useEffect(() => {
    if (!car?.options) return;
    const next = {};
    for (const option of car.options) {
      if (option.is_default) next[option.category] = option.id;
    }
    setSelected(next);
  }, [car]);

  useEffect(() => {
    if (!justAdded) return undefined;
    const timer = window.setTimeout(() => setJustAdded(false), 2600);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  useEffect(() => {
    if (!car) return undefined;
    const site = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "fonix-product-jsonld";
    document.getElementById("fonix-product-jsonld")?.remove();
    const available = car.allocation_open && car.slots_remaining > 0;
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: `FoNix ${car.name}`,
      description: car.tagline || car.description,
      image: car.thumbnail,
      brand: { "@type": "Brand", name: "FoNix" },
      offers: {
        "@type": "Offer",
        priceCurrency: "GBP",
        price: String(car.base_price),
        availability: available
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/OutOfStock",
        url: site ? `${site}/store/${car.slug}` : undefined,
      },
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [car]);

  const extras = useMemo(() => {
    if (!car?.options) return [];
    return car.options.filter((option) => selected[option.category] === option.id);
  }, [car, selected]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const option of car?.options ?? []) {
      (groups[option.category] ??= []).push(option);
    }
    return groups;
  }, [car]);

  if (isLoading) return <LoadingState label="Loading model" />;

  if (error) {
    return (
      <div className="fx-container pb-24">
        <ErrorState message={error} onRetry={retry} />
        <div className="flex justify-center">
          <Button to="/store" variant="ghost">
            Back to the range
          </Button>
        </div>
      </div>
    );
  }

  if (!car) return null;

  const specs = headlineSpecs(car);
  const sheet = specSheet(car);
  const gallery =
    car.images?.length > 0
      ? car.images
      : [{ id: "thumbnail", image: car.thumbnail, alt_text: car.thumbnail_alt }];

  const configuredPrice =
    Number(car.base_price) +
    extras.reduce((sum, option) => sum + Number(option.price_delta), 0);
  const waitlist = !car.allocation_open || car.slots_remaining === 0;
  const inCart = lines.find((line) => line.slug === car.slug);
  const waitlistHref = `/contact?subject=${encodeURIComponent(`Waitlist: ${car.name}`)}`;

  function handleAddToCart() {
    addItem(car, 1, extras);
    setJustAdded(true);
  }

  return (
    <article className="pb-32 lg:pb-32">
      <div className="fx-container">
        <nav aria-label="Breadcrumb" className="pb-8">
          <Link
            to="/store"
            className="inline-flex min-h-11 items-center font-body text-xs uppercase tracking-[0.16em] text-faint transition-colors hover:text-white"
          >
            <span aria-hidden="true" className="mr-2">
              ←
            </span>
            The range
          </Link>
        </nav>

        {/* Three grid children: media, the buy panel, and the spec sheet.
            On a phone (one column) they stack in source order -- media, buy
            panel, spec -- so a buyer sees the car name, price and configurator
            straight after the gallery instead of scrolling past the whole spec
            table first. On desktop, explicit placement keeps media and spec in
            the left column with the buy panel spanning both rows on the right. */}
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-x-16 lg:gap-y-12">
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="overflow-hidden rounded-card border border-hairline bg-graphite/60">
              <img
                src={gallery[activeImage].image}
                alt={gallery[activeImage].alt_text}
                width={1600}
                height={900}
                className="aspect-16/9 w-full object-cover"
              />
            </div>

            {gallery.length > 1 ? (
              <div
                role="group"
                aria-label="Gallery images"
                className="mt-4 grid grid-cols-4 gap-3"
              >
                {gallery.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-pressed={index === activeImage}
                    aria-label={`View image ${index + 1} of ${gallery.length}`}
                    className={`overflow-hidden rounded-input border transition-colors duration-300 ${
                      index === activeImage
                        ? "border-ember"
                        : "border-hairline hover:border-white/30"
                    }`}
                  >
                    <img
                      src={image.image}
                      alt=""
                      loading="lazy"
                      className="aspect-16/9 w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            {!car.has_real_imagery ? (
              <p className="mt-5 font-body text-xs leading-relaxed text-faint">
                Photography for the {car.name} has not been produced yet. The
                image above is FoNix brand artwork, shown in place of a
                relabelled photograph of a different model.
              </p>
            ) : null}
          </div>

          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:pt-4">
            {car.is_hero ? <p className="fx-eyebrow">Flagship</p> : null}

            <h1
              className="mt-3 font-heading font-bold leading-[1.05] text-white"
              style={{ fontSize: "clamp(2rem, 1.3rem + 3vw, 3.25rem)" }}
            >
              {car.name}
            </h1>

            {car.tagline ? (
              <p className="mt-4 font-body text-lg text-muted">{car.tagline}</p>
            ) : null}

            <p className="mt-8 font-heading text-3xl font-bold text-white">
              {formatPrice(configuredPrice)}
            </p>
            <p className="mt-1.5 font-body text-xs text-faint">
              UK price as configured. One allocation per order.
              {car.slots_remaining != null
                ? ` ${car.slots_remaining} slot${car.slots_remaining === 1 ? "" : "s"} remaining.`
                : ""}
            </p>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-y border-hairline py-7">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                    {spec.label}
                  </dt>
                  <dd className="mt-2 font-heading text-lg font-bold text-white sm:text-2xl">
                    {spec.value}
                    <span className="ml-1 font-body text-xs font-normal text-faint">
                      {spec.unit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            {Object.keys(grouped).length > 0 ? (
              <div className="mt-8 space-y-6">
                {Object.entries(grouped).map(([category, options]) => (
                  <fieldset key={category}>
                    <legend className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                      {OPTION_LABELS[category] ?? category}
                    </legend>
                    <div className="mt-3 space-y-2">
                      {options.map((option) => {
                        const checked = selected[category] === option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-input border px-4 py-3 font-body text-sm transition-colors ${
                              checked
                                ? "border-ember/50 bg-ember/10 text-white"
                                : "border-hairline text-muted hover:border-white/25 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`option-${category}`}
                                checked={checked}
                                onChange={() =>
                                  setSelected((current) => ({
                                    ...current,
                                    [category]: option.id,
                                  }))
                                }
                                className="accent-ember"
                              />
                              {option.name}
                            </span>
                            <span className="text-xs text-faint">
                              {formatPriceDelta(option.price_delta)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : null}

            <div className="mt-10 hidden flex-col gap-3 sm:flex-row lg:flex">
              {waitlist ? (
                <Button to={waitlistHref} size="lg" fullWidth>
                  Join the waitlist
                </Button>
              ) : (
                <Button onClick={handleAddToCart} size="lg" fullWidth>
                  {inCart ? "Update configuration" : "Hold allocation"}
                </Button>
              )}
              {inCart ? (
                <Button to="/cart" variant="ghost" size="lg" fullWidth>
                  View cart
                </Button>
              ) : null}
            </div>

            <p
              role="status"
              className={`mt-4 font-body text-xs transition-opacity duration-300 ${
                justAdded ? "text-ember opacity-100" : "opacity-0"
              }`}
            >
              {justAdded ? `${car.name} is in your cart.` : ""}
            </p>

            {waitlist ? (
              <p className="mt-4 font-body text-xs leading-relaxed text-faint">
                {car.allocation_open
                  ? "This allocation is full. Join the waitlist and the hangar will write when a slot returns."
                  : "This model is not taking allocations. Join the waitlist and we will tell you when it opens."}
              </p>
            ) : (
            <p className="mt-4 font-body text-xs leading-relaxed text-faint">
                Holding an allocation records a pending slot against your
                account. Checkout authorises a 10% demonstration reservation.
                You can cancel it from your orders while it is still pending.
            </p>
            )}

            <div className="mt-10 whitespace-pre-line font-body text-sm leading-relaxed text-muted">
              {car.description}
            </div>
          </div>

          {sheet.length > 0 ? (
            <section className="lg:col-start-1 lg:row-start-2">
              <h2 className="font-heading text-lg font-bold text-white">
                Specification
              </h2>
              <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
                {sheet.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-6 py-3"
                  >
                    <dt className="font-body text-xs uppercase tracking-[0.14em] text-faint">
                      {row.label}
                    </dt>
                    <dd className="font-body text-sm text-white">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-void/95 px-4 pt-3 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-bold text-white">{car.name}</p>
            <p className="font-body text-xs text-muted">{formatPrice(configuredPrice)}</p>
          </div>
          {waitlist ? (
            <Button to={waitlistHref} size="sm">
              Waitlist
            </Button>
          ) : (
            <Button onClick={handleAddToCart} size="sm">
              {inCart ? "Update" : "Hold slot"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

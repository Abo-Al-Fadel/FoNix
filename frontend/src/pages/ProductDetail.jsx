import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchCar } from "../api/endpoints.js";
import Button from "../components/ui/Button.jsx";
import { ErrorState, LoadingState } from "../components/ui/StateBlock.jsx";
import { useCart } from "../context/CartContext.jsx";
import useApiResource from "../hooks/useApiResource.js";
import usePageTitle from "../hooks/usePageTitle.js";
import { formatPrice, headlineSpecs } from "../lib/format.js";
import { titleForPath } from "../lib/pageTitle.js";

export default function ProductDetail() {
  const { slug } = useParams();
  const { addItem, lines, maxQuantity } = useCart();

  // Keyed on slug so navigating between two cars refetches rather than
  // reusing the first car's data.
  const fetcher = useCallback(() => fetchCar(slug, { publicOnly: true }), [slug]);
  const { data: car, error, isLoading, retry } = useApiResource(fetcher);
  usePageTitle(car?.name ? `${car.name} | FoNix` : titleForPath(`/store/${slug}`));

  const [activeImage, setActiveImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  // Reset the gallery when the car changes -- otherwise arriving at a car with
  // one image while index 3 is selected renders nothing.
  useEffect(() => setActiveImage(0), [slug]);

  // Clear the "added" confirmation after a moment. The cleanup matters: without
  // it, navigating away mid-timeout would try to set state on an unmounted
  // component.
  useEffect(() => {
    if (!justAdded) return undefined;
    const timer = window.setTimeout(() => setJustAdded(false), 2600);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

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
  // The gallery falls back to the thumbnail so a car with no gallery rows still
  // renders a picture rather than an empty frame.
  const gallery =
    car.images?.length > 0
      ? car.images
      : [{ id: "thumbnail", image: car.thumbnail, alt_text: car.thumbnail_alt }];

  const inCart = lines.find((line) => line.slug === car.slug);
  const atMax = inCart ? inCart.quantity >= maxQuantity : false;

  function handleAddToCart() {
    addItem(car, 1);
    setJustAdded(true);
  }

  return (
    <article className="pb-24 md:pb-32">
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

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          {/* ---------------- Gallery ---------------- */}
          <div>
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
              /*
                Thumbnails are real <button>s in a labelled group, not clickable
                divs -- so they are reachable by keyboard and announce their
                selected state. aria-pressed is what conveys "this is the one
                currently showing".
              */
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
                      // Decorative here: the button's aria-label already names
                      // it, and repeating the full description four times would
                      // just be noise.
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

          {/* ---------------- Detail ---------------- */}
          <div className="lg:pt-4">
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
              {formatPrice(car.base_price)}
            </p>
            <p className="mt-1.5 font-body text-xs text-faint">
              Indicative UK price before options and delivery.
            </p>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-y border-hairline py-7">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt className="font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                    {spec.label}
                  </dt>
                  <dd className="mt-2 font-heading text-2xl font-bold text-white">
                    {spec.value}
                    <span className="ml-1 font-body text-xs font-normal text-faint">
                      {spec.unit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleAddToCart}
                disabled={atMax}
                size="lg"
                fullWidth
              >
                {atMax ? `Maximum ${maxQuantity} reached` : "Add to cart"}
              </Button>
              {inCart ? (
                <Button to="/cart" variant="ghost" size="lg" fullWidth>
                  View cart
                </Button>
              ) : null}
            </div>

            {/*
              role="status" announces the confirmation to a screen reader
              without stealing focus. A purely visual toast would leave a
              non-sighted user with no feedback that the click worked.
            */}
            <p
              role="status"
              className={`mt-4 font-body text-xs transition-opacity duration-300 ${
                justAdded ? "text-ember opacity-100" : "opacity-0"
              }`}
            >
              {justAdded ? `${car.name} added to your cart.` : ""}
            </p>

            {/*
              whitespace-pre-line renders the double newlines the seed copy
              uses as real paragraph breaks, without needing the API to send
              HTML (which would then need sanitising).
            */}
            <div className="mt-10 whitespace-pre-line font-body text-sm leading-relaxed text-muted">
              {car.description}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

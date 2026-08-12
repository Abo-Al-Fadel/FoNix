import { useCallback } from "react";

import { fetchCars } from "../api/endpoints.js";
import CarCard from "../components/store/CarCard.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/ui/StateBlock.jsx";
import useApiResource from "../hooks/useApiResource.js";

export default function Store() {
  // useCallback keeps the fetcher's identity stable across renders. Without it,
  // useApiResource's effect would see a new function every render and refetch
  // forever.
  const fetcher = useCallback(() => fetchCars(), []);
  const { data: cars, error, isLoading, retry } = useApiResource(fetcher);

  return (
    <div className="pb-24 md:pb-32">
      <PageHeader
        eyebrow="The range"
        title="Four cars. One argument."
        lede="Every FoNix starts from the same premise: that the fastest way through a corner and the most restrained way to draw a car are the same problem. Here is where that has taken us so far."
      />

      <div className="fx-container">
        {isLoading ? <LoadingState label="Loading the range" /> : null}

        {error ? <ErrorState message={error} onRetry={retry} /> : null}

        {cars && cars.length === 0 ? (
          <EmptyState title="The range is empty">
            No models have been published yet. If you are running this locally,
            seed the catalog with{" "}
            <code className="text-white">python manage.py seed_catalog</code>.
          </EmptyState>
        ) : null}

        {cars && cars.length > 0 ? (
          <>
            {/* A list, semantically: it is a list of products, and a screen
                reader announcing "4 items" up front is genuinely useful
                orientation. list-none strips the bullets, not the semantics. */}
            <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {cars.map((car) => (
                <li key={car.slug} className="flex">
                  <CarCard car={car} />
                </li>
              ))}
            </ul>

            <p className="mt-14 max-w-2xl font-body text-sm leading-relaxed text-faint">
              Photography currently exists for the Ignis only. Models marked
              “visualisation pending” are shown with brand artwork rather than a
              relabelled photograph of a different car.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

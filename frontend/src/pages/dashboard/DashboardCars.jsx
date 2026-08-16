import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { extractErrorMessage } from "../../api/client.js";
import { deleteCar, fetchCars, updateCar } from "../../api/endpoints.js";
import Button from "../../components/ui/Button.jsx";
import FormError from "../../components/ui/FormError.jsx";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/StateBlock.jsx";
import useApiResource from "../../hooks/useApiResource.js";
import { formatPrice } from "../../lib/format.js";

/**
 * Catalogue management for staff and above. Lists every car -- including hidden
 * ones, which the public store never returns -- with controls to hide/unhide,
 * edit, add or delete.
 */
export default function DashboardCars() {
  const fetcher = useCallback(() => fetchCars(), []);
  const { data: cars, setData, error, isLoading, retry } = useApiResource(fetcher);

  const [busySlug, setBusySlug] = useState(null);
  const [actionError, setActionError] = useState("");

  async function togglePublished(car) {
    const next = !car.is_published;
    setBusySlug(car.slug);
    setActionError("");
    // Flip the row immediately so the table does not unmount into the 45vh
    // loading block while the PATCH is in flight.
    setData((list) =>
      list.map((row) =>
        row.slug === car.slug ? { ...row, is_published: next } : row,
      ),
    );
    try {
      await updateCar(car.slug, { is_published: next });
    } catch (caught) {
      setData((list) =>
        list.map((row) =>
          row.slug === car.slug ? { ...row, is_published: !next } : row,
        ),
      );
      setActionError(extractErrorMessage(caught));
    } finally {
      setBusySlug(null);
    }
  }

  async function remove(car) {
    if (!window.confirm(`Delete ${car.name}? This cannot be undone.`)) return;
    setBusySlug(car.slug);
    setActionError("");
    const snapshot = cars;
    setData((list) => list.filter((row) => row.slug !== car.slug));
    try {
      await deleteCar(car.slug);
    } catch (caught) {
      setData(snapshot);
      // A car referenced by an order is PROTECTed server-side; surface that
      // rather than letting the request fail silently.
      setActionError(extractErrorMessage(caught, "That car could not be deleted."));
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="font-heading text-xl font-bold text-white md:text-2xl">
          Catalogue
        </h2>
        <Button to="/dashboard/cars/new" size="sm">
          Add car
        </Button>
      </div>

      {actionError ? <FormError>{actionError}</FormError> : null}

      {isLoading && !cars ? <LoadingState label="Loading the catalogue" /> : null}
      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {cars && cars.length === 0 ? (
        <EmptyState title="No cars yet">
          <p className="mb-8">Add the first model to the catalogue.</p>
          <Button to="/dashboard/cars/new">Add car</Button>
        </EmptyState>
      ) : null}

      {cars && cars.length > 0 ? (
        <>
          <ul className="list-none space-y-3 md:hidden">
            {cars.map((car) => (
              <li
                key={car.slug}
                className={`rounded-card border border-hairline bg-graphite/50 p-4 ${
                  busySlug === car.slug ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {car.thumbnail ? (
                    <img
                      src={car.thumbnail}
                      alt=""
                      className="aspect-16/9 w-20 shrink-0 rounded-input object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-base font-semibold text-white">
                      {car.name}
                    </p>
                    <p className="mt-1 font-body text-sm text-muted">
                      {formatPrice(car.base_price)} · {car.slots_remaining ?? "—"} slots
                      {car.allocation_open === false ? " · closed" : ""}
                    </p>
                    <p className="mt-1 font-body text-[10px] uppercase tracking-[0.14em] text-faint">
                      {car.is_published ? "Live" : "Hidden"}
                      {car.is_hero ? " · Flagship" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePublished(car)}
                    disabled={busySlug === car.slug}
                    className="min-h-11 rounded-input border border-hairline px-3 font-body text-xs text-muted"
                  >
                    {car.is_published ? "Hide" : "Unhide"}
                  </button>
                  <Link
                    to={`/dashboard/cars/${car.slug}/edit`}
                    className="inline-flex min-h-11 items-center rounded-input border border-hairline px-3 font-body text-xs text-muted"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(car)}
                    disabled={busySlug === car.slug}
                    className="min-h-11 rounded-input border border-hairline px-3 font-body text-xs text-faint"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-card border border-hairline md:block">
            <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline bg-graphite/40 font-body text-[10px] uppercase tracking-[0.16em] text-faint">
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Slots</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr
                  key={car.slug}
                  className={`border-b border-hairline last:border-0 ${
                    busySlug === car.slug ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {car.thumbnail ? (
                        <img
                          src={car.thumbnail}
                          alt=""
                          className="aspect-16/9 w-14 shrink-0 rounded-input object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-heading text-sm font-semibold text-white">
                          {car.name}
                        </p>
                        {car.is_hero ? (
                          <span className="font-body text-[10px] uppercase tracking-[0.14em] text-ember">
                            Flagship
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted">
                    {formatPrice(car.base_price)}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-muted">
                    {car.slots_remaining ?? "—"}
                    {car.allocation_open === false ? " · closed" : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-3 py-1 font-body text-[10px] font-medium uppercase tracking-[0.14em] ${
                        car.is_published
                          ? "border-ice/40 text-ice"
                          : "border-hairline text-faint"
                      }`}
                    >
                      {car.is_published ? "Live" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => togglePublished(car)}
                        disabled={busySlug === car.slug}
                        aria-busy={busySlug === car.slug}
                        className="rounded-input border border-hairline px-3 py-1.5 font-body text-xs text-muted transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
                      >
                        {car.is_published ? "Hide" : "Unhide"}
                      </button>
                      <Link
                        to={`/dashboard/cars/${car.slug}/edit`}
                        className="rounded-input border border-hairline px-3 py-1.5 font-body text-xs text-muted transition-colors hover:border-white/25 hover:text-white"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(car)}
                        disabled={busySlug === car.slug}
                        className="rounded-input border border-hairline px-3 py-1.5 font-body text-xs text-faint transition-colors hover:border-ember/50 hover:text-ember disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

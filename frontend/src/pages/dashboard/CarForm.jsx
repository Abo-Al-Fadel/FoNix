import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { extractErrorMessage } from "../../api/client.js";
import { createCar, fetchCar, updateCar } from "../../api/endpoints.js";
import Button from "../../components/ui/Button.jsx";
import Field from "../../components/ui/Field.jsx";
import FormError from "../../components/ui/FormError.jsx";
import { LoadingState } from "../../components/ui/StateBlock.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useApiResource from "../../hooks/useApiResource.js";

const EMPTY = {
  name: "",
  tagline: "",
  description: "",
  base_price: "",
  cost: "",
  range_km: "",
  top_speed_kmh: "",
  acceleration_0_100: "",
  power_kw: "",
  torque_nm: "",
  weight_kg: "",
  battery_kwh: "",
  charge_10_80_min: "",
  ac_kw: "",
  length_mm: "",
  width_mm: "",
  height_mm: "",
  seats: "2",
  drivetrain: "",
  motor_count: "1",
  body_style: "",
  warranty_years: "4",
  service_interval: "",
  country_of_build: "United Kingdom",
  homologation: "",
  slots_remaining: "12",
  lead_time_weeks: "16",
  max_order_quantity: "1",
  thumbnail_alt: "",
  is_hero: false,
  has_real_imagery: false,
  is_published: true,
  allocation_open: true,
};

const TEXT_FIELDS = [
  "name",
  "tagline",
  "description",
  "base_price",
  "cost",
  "range_km",
  "top_speed_kmh",
  "acceleration_0_100",
  "power_kw",
  "torque_nm",
  "weight_kg",
  "battery_kwh",
  "charge_10_80_min",
  "ac_kw",
  "length_mm",
  "width_mm",
  "height_mm",
  "seats",
  "drivetrain",
  "motor_count",
  "body_style",
  "warranty_years",
  "service_interval",
  "country_of_build",
  "homologation",
  "slots_remaining",
  "lead_time_weeks",
  "max_order_quantity",
  "thumbnail_alt",
];
const BOOL_FIELDS = ["is_hero", "has_real_imagery", "is_published", "allocation_open"];

export default function CarForm() {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const pricingLocked = isEdit && !isAdmin;

  const [form, setForm] = useState(EMPTY);
  const [thumbnail, setThumbnail] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // In edit mode, load the existing car (staff get the admin shape, so cost and
  // is_published come back too).
  const fetcher = useCallback(() => fetchCar(slug), [slug]);
  const { data: existing, isLoading } = useApiResource(fetcher, {
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      ...EMPTY,
      ...Object.fromEntries(
        [...TEXT_FIELDS, ...BOOL_FIELDS].map((key) => [key, existing[key] ?? EMPTY[key]]),
      ),
    });
  }, [existing]);

  const update = (key) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const body = new FormData();
    for (const key of TEXT_FIELDS) {
      if (!isAdmin && key === "cost") continue;
      if (pricingLocked && key === "base_price") continue;
      if (form[key] !== "" && form[key] != null) body.append(key, form[key]);
    }
    for (const key of BOOL_FIELDS) {
      body.append(key, form[key] ? "true" : "false");
    }
    if (thumbnail) body.append("thumbnail", thumbnail);

    try {
      if (isEdit) {
        await updateCar(slug, body);
      } else {
        await createCar(body);
      }
      navigate("/dashboard/cars");
    } catch (caught) {
      setError(extractErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  if (isEdit && isLoading) {
    return <LoadingState label="Loading the car" />;
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-6 font-heading text-xl font-bold text-white md:text-2xl">
        {isEdit ? `Edit ${existing?.name ?? "car"}` : "Add a car"}
      </h2>

      {error ? <FormError>{error}</FormError> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Name" value={form.name} onChange={update("name")} required />
        <Field
          label="Tagline"
          value={form.tagline}
          onChange={update("tagline")}
          hint="One short line shown under the name."
        />

        <div>
          <label className="block font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={update("description")}
            rows={4}
            required
            className="mt-2.5 w-full rounded-input border border-hairline bg-graphite/60 px-4 py-3 font-body text-sm text-white transition-colors focus:border-white/30 focus:outline-none"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Base price (GBP)"
            type="number"
            step="0.01"
            value={form.base_price}
            onChange={update("base_price")}
            required={!pricingLocked}
            disabled={pricingLocked}
            hint={
              pricingLocked
                ? "List price is an admin decision. Staff update spec, imagery and slots."
                : isEdit
                  ? "Changing this rewrites what the store shows. Staff cannot do this."
                  : "Initial list price. After the car exists, only an admin can change it."
            }
          />
          {isAdmin ? (
            <Field
              label="Cost (GBP)"
              type="number"
              step="0.01"
              value={form.cost}
              onChange={update("cost")}
              hint="Internal only. Drives margin; never shown to staff or the public."
            />
          ) : null}
          <Field
            label="Range (km)"
            type="number"
            value={form.range_km}
            onChange={update("range_km")}
            required
          />
          <Field
            label="Top speed (km/h)"
            type="number"
            value={form.top_speed_kmh}
            onChange={update("top_speed_kmh")}
            required
          />
          <Field
            label="0–100 km/h (s)"
            type="number"
            step="0.01"
            value={form.acceleration_0_100}
            onChange={update("acceleration_0_100")}
            required
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Power (kW)" type="number" value={form.power_kw} onChange={update("power_kw")} />
          <Field label="Torque (Nm)" type="number" value={form.torque_nm} onChange={update("torque_nm")} />
          <Field label="Weight (kg)" type="number" value={form.weight_kg} onChange={update("weight_kg")} />
          <Field label="Battery (kWh)" type="number" step="0.1" value={form.battery_kwh} onChange={update("battery_kwh")} />
          <Field label="DC 10–80 (min)" type="number" value={form.charge_10_80_min} onChange={update("charge_10_80_min")} />
          <Field label="AC charge (kW)" type="number" step="0.1" value={form.ac_kw} onChange={update("ac_kw")} />
          <Field label="Length (mm)" type="number" value={form.length_mm} onChange={update("length_mm")} />
          <Field label="Width (mm)" type="number" value={form.width_mm} onChange={update("width_mm")} />
          <Field label="Height (mm)" type="number" value={form.height_mm} onChange={update("height_mm")} />
          <Field label="Seats" type="number" value={form.seats} onChange={update("seats")} />
          <Field label="Drivetrain" value={form.drivetrain} onChange={update("drivetrain")} />
          <Field label="Motors" type="number" value={form.motor_count} onChange={update("motor_count")} />
          <Field
            label="Body style"
            value={form.body_style}
            onChange={update("body_style")}
            hint="coupe, gt, track, saloon or suv"
          />
          <Field label="Warranty (years)" type="number" value={form.warranty_years} onChange={update("warranty_years")} />
          <Field label="Service interval" value={form.service_interval} onChange={update("service_interval")} />
          <Field label="Built in" value={form.country_of_build} onChange={update("country_of_build")} />
          <Field label="Homologation" value={form.homologation} onChange={update("homologation")} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Slots remaining" type="number" value={form.slots_remaining} onChange={update("slots_remaining")} />
          <Field label="Lead time (weeks)" type="number" value={form.lead_time_weeks} onChange={update("lead_time_weeks")} />
          <Field
            label="Max per order"
            type="number"
            value={form.max_order_quantity}
            onChange={update("max_order_quantity")}
            hint="An allocation is one car unless you raise this."
          />
        </div>

        <div>
          <label className="block font-body text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Thumbnail {isEdit ? "(leave blank to keep current)" : ""}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
            className="mt-2.5 block w-full font-body text-sm text-muted file:mr-4 file:rounded-input file:border-0 file:bg-graphite file:px-4 file:py-2 file:font-body file:text-xs file:uppercase file:tracking-[0.14em] file:text-white"
          />
        </div>

        <Field
          label="Thumbnail alt text"
          value={form.thumbnail_alt}
          onChange={update("thumbnail_alt")}
          hint="Describe the image for screen readers."
        />

        <div className="space-y-3 rounded-card border border-hairline bg-graphite/40 p-5">
          {[
            { key: "is_published", label: "Live in the public store" },
            { key: "allocation_open", label: "Allocation open (otherwise the store shows a waitlist)" },
            { key: "has_real_imagery", label: "Has real photography (no “visualisation pending” badge)" },
            { key: "is_hero", label: "Flagship on the homepage" },
          ].map((toggle) => (
            <label
              key={toggle.key}
              className="flex items-center gap-3 font-body text-sm text-muted"
            >
              <input
                type="checkbox"
                checked={form[toggle.key]}
                onChange={update(toggle.key)}
                className="h-4 w-4 accent-ember"
              />
              {toggle.label}
            </label>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create car"}
          </Button>
          <Button to="/dashboard/cars" variant="ghost">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CheckboxRow,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
  Textarea,
} from "@/components/ui";
import { deleteService, saveService } from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import type { ServiceOfferingRow } from "@/lib/data/types";
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_DESCRIPTIONS,
  PRODUCT_TYPE_LABELS,
  SERVICE_MODES,
  SERVICE_MODE_LABELS,
  productNeedsDuration,
  type ProductType,
} from "@/lib/domain/enums";

const PRODUCT_CATEGORIES = [
  "Consultation",
  "Training program",
  "Nutrition",
  "Recovery & mobility",
  "Clinical care",
  "Coaching",
  "Assessment",
  "Other",
];

export function ProductsForm({ services }: { services: ServiceOfferingRow[] }) {
  const [adding, setAdding] = useState(services.length === 0);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Products & pricing"
        description="What a DexaFit customer can buy or book with you. Add these whenever you like — they are not part of your application, and you can change them at any time."
      />

      <Callout tone="info" title="Booking and payment stay with you for now">
        DexaFit does not yet handle scheduling or payment. Link your own booking or
        checkout page, or leave it blank and customers will send you a contact request.
      </Callout>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Your products</p>
          {!adding ? (
            <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
              Add product
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {services.length === 0 && !adding ? (
            <EmptyState>No products yet.</EmptyState>
          ) : null}

          {services.map((service) =>
            editing === service.id ? (
              <ProductForm
                key={service.id}
                service={service}
                onDone={() => setEditing(null)}
              />
            ) : (
              <ProductSummary
                key={service.id}
                service={service}
                onEdit={() => setEditing(service.id)}
              />
            ),
          )}

          {adding ? <ProductForm service={null} onDone={() => setAdding(false)} /> : null}
        </div>
      </Card>
    </div>
  );
}

function ProductSummary({
  service,
  onEdit,
}: {
  service: ServiceOfferingRow;
  onEdit: () => void;
}) {
  const [, deleteAction, deletePending] = useActionState(deleteService, idleState);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{service.service_name}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{service.service_description}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{SERVICE_MODE_LABELS[service.modality]}</Badge>
          <Badge tone="neutral">{PRODUCT_TYPE_LABELS[service.product_type as ProductType]}</Badge>
          {service.duration_minutes ? <Badge>{service.duration_minutes} min</Badge> : null}
          {service.price_amount != null ? (
            <Badge>${Number(service.price_amount).toLocaleString()}</Badge>
          ) : null}
          {service.free_intro_consult ? (
            <Badge tone="success">Free intro consult</Badge>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={service.id} />
          <Button type="submit" variant="danger" disabled={deletePending}>
            Remove
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProductForm({
  service,
  onDone,
}: {
  service: ServiceOfferingRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveService, idleState);
  const [acceptsInsurance, setAcceptsInsurance] = useState(
    service?.accepts_insurance ?? false,
  );
  // Chosen first, because it decides which of the fields below apply: something
  // bought outright has no appointment length and no delivery mode.
  const [productType, setProductType] = useState<ProductType>(
    (service?.product_type as ProductType) ?? "IN_PERSON_SERVICE",
  );
  const needsDuration = productNeedsDuration(productType);
  const errors = state.fieldErrors ?? {};
  const key = service?.id ?? "new";

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="rounded-xl border border-accent/40 bg-white p-4">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-semibold text-ink">
          What kind of product is this?
        </legend>
        <p className="mb-3 text-xs text-muted">
          This decides what else we ask for.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRODUCT_TYPES.map((type) => (
            <label
              key={type}
              className={`cursor-pointer rounded-xl border p-3 text-left transition ${
                productType === type
                  ? "border-accent bg-accent/5"
                  : "border-line hover:border-accent/40"
              }`}
            >
              <input
                type="radio"
                name="productType"
                value={type}
                checked={productType === type}
                onChange={() => setProductType(type)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-ink">
                {PRODUCT_TYPE_LABELS[type]}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {PRODUCT_TYPE_DESCRIPTIONS[type]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor={`name-${key}`} required error={errors.serviceName}>
          <Input
            id={`name-${key}`}
            name="serviceName"
            placeholder="Initial body composition consultation"
            defaultValue={service?.service_name ?? ""}
            required
          />
        </Field>
        <Field label="Category" htmlFor={`category-${key}`} required>
          <Select
            id={`category-${key}`}
            name="serviceCategory"
            defaultValue={service?.service_category ?? PRODUCT_CATEGORIES[0]}
          >
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Description"
          htmlFor={`description-${key}`}
          required
          error={errors.serviceDescription}
        >
          <Textarea
            id={`description-${key}`}
            name="serviceDescription"
            defaultValue={service?.service_description ?? ""}
            maxLength={1000}
            required
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Delivery" htmlFor={`modality-${key}`} required>
          <Select
            id={`modality-${key}`}
            name="modality"
            defaultValue={service?.modality ?? "IN_PERSON"}
          >
            {SERVICE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {SERVICE_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>
        {needsDuration ? (
          <Field
            label="Duration (minutes)"
            htmlFor={`duration-${key}`}
            required
            error={errors.durationMinutes}
          >
            <Input
              id={`duration-${key}`}
              name="durationMinutes"
              type="number"
              min={1}
              defaultValue={service?.duration_minutes ?? 60}
              required
            />
          </Field>
        ) : null}
        <Field label="Price (USD, optional)" htmlFor={`price-${key}`}>
          <Input
            id={`price-${key}`}
            name="priceAmount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={service?.price_amount ?? ""}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Booking link (optional)"
          htmlFor={`booking-${key}`}
          hint="Your own scheduling page. Leave blank to receive contact requests instead."
          error={errors.bookingUrl}
        >
          <Input
            id={`booking-${key}`}
            name="bookingUrl"
            type="url"
            defaultValue={service?.booking_url ?? ""}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CheckboxRow
          name="freeIntroConsult"
          value="true"
          label="Free intro consult"
          defaultChecked={service?.free_intro_consult ?? false}
        />
        <CheckboxRow
          name="acceptsSelfPay"
          value="true"
          label="Accepts self-pay"
          defaultChecked={service?.accepts_self_pay ?? true}
        />
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 text-sm hover:bg-slate-50 has-checked:border-accent has-checked:bg-emerald-50/50">
          <input
            type="checkbox"
            name="acceptsInsurance"
            value="true"
            checked={acceptsInsurance}
            onChange={(e) => setAcceptsInsurance(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span className="font-medium text-ink">Accepts insurance</span>
        </label>
      </div>

      {acceptsInsurance ? (
        <div className="mt-4">
          <Field
            label="Which plans?"
            htmlFor={`insurance-notes-${key}`}
            required
            error={errors.insuranceNotes}
          >
            <Input
              id={`insurance-notes-${key}`}
              name="insuranceNotes"
              defaultValue={service?.insurance_notes ?? ""}
              required
            />
          </Field>
        </div>
      ) : null}

      {state.message && !state.ok ? (
        <p className="mt-3 text-xs font-medium text-rose-600">{state.message}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save service"}
        </Button>
      </div>
    </form>
  );
}

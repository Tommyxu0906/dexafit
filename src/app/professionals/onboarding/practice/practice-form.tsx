"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Callout,
  Card,
  CheckboxRow,
  Field,
  Input,
  SectionHeading,
  Select,
} from "@/components/ui";
import { savePractice } from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import type { ProfessionalProfileRow } from "@/lib/data/types";
import {
  DEFAULT_COUNTRY,
  JOINING_AS,
  JOINING_AS_LABELS,
  SERVICE_MODES,
  SERVICE_MODE_LABELS,
  US_STATES,
  type JoiningAs,
  type ServiceMode,
} from "@/lib/domain/enums";

type OrganizationRow = {
  legal_name: string | null;
  dba: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function PracticeForm({
  profile,
  organization,
}: {
  profile: ProfessionalProfileRow;
  organization: OrganizationRow | null;
}) {
  const [state, formAction, pending] = useActionState(savePractice, idleState);
  const [joiningAs, setJoiningAs] = useState<JoiningAs>(
    profile.joining_as ?? "INDIVIDUAL",
  );
  const [serviceModes, setServiceModes] = useState<ServiceMode[]>(
    profile.service_modes?.length ? profile.service_modes : ["IN_PERSON"],
  );

  const errors = state.fieldErrors ?? {};
  const isOrganization = joiningAs !== "INDIVIDUAL";

  function toggleMode(mode: ServiceMode, checked: boolean) {
    setServiceModes((current) =>
      checked ? [...current, mode] : current.filter((m) => m !== mode),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <SectionHeading
        title="Practice"
        description="Tell us how you practice and where customers can reach you."
      />

      {state.message && !state.ok ? <Callout tone="danger">{state.message}</Callout> : null}

      <Card>
        <Field label="Joining DexaFit as" htmlFor="joiningAs" required>
          <Select
            id="joiningAs"
            name="joiningAs"
            value={joiningAs}
            onChange={(e) => setJoiningAs(e.target.value as JoiningAs)}
          >
            {JOINING_AS.map((option) => (
              <option key={option} value={option}>
                {JOINING_AS_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Practice name" htmlFor="practiceName" error={errors.practiceName}>
            <Input
              id="practiceName"
              name="practiceName"
              defaultValue={profile.practice_name ?? ""}
            />
          </Field>

          {isOrganization ? (
            <>
              <Field
                label="Organization legal name"
                htmlFor="organizationLegalName"
                required
                error={errors.organizationLegalName}
              >
                <Input
                  id="organizationLegalName"
                  name="organizationLegalName"
                  defaultValue={organization?.legal_name ?? ""}
                />
              </Field>
              <Field label="DBA (optional)" htmlFor="organizationDba">
                <Input
                  id="organizationDba"
                  name="organizationDba"
                  defaultValue={organization?.dba ?? ""}
                />
              </Field>
            </>
          ) : null}

          <Field label="Business email" htmlFor="businessEmail" required error={errors.businessEmail}>
            <Input
              id="businessEmail"
              name="businessEmail"
              type="email"
              defaultValue={profile.business_email ?? profile.email ?? ""}
              required
            />
          </Field>
          <Field label="Business phone" htmlFor="businessPhone" required error={errors.businessPhone}>
            <Input
              id="businessPhone"
              name="businessPhone"
              type="tel"
              defaultValue={profile.business_phone ?? profile.phone ?? ""}
              required
            />
          </Field>
          <Field label="Business website" htmlFor="businessWebsite" error={errors.businessWebsite}>
            <Input
              id="businessWebsite"
              name="businessWebsite"
              type="url"
              defaultValue={profile.business_website ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <Field
          label="How do you deliver services?"
          required
          hint="Select every mode you offer."
          error={errors.serviceModes}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {SERVICE_MODES.map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm hover:bg-slate-50 has-checked:border-accent has-checked:bg-emerald-50/50"
              >
                <input
                  type="checkbox"
                  name="serviceModes"
                  value={mode}
                  checked={serviceModes.includes(mode)}
                  onChange={(e) => toggleMode(mode, e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className="font-medium text-ink">{SERVICE_MODE_LABELS[mode]}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">Business address</p>
          <p className="mt-1 mb-4 text-xs text-muted">
            Required for every provider, including virtual-only. We use it to verify
            your identity and for legal contact — it is not shown to customers.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Address line 1" htmlFor="businessAddress1" required error={errors.businessAddress1}>
              <Input
                id="businessAddress1"
                name="businessAddress1"
                defaultValue={organization?.address_1 ?? ""}
              />
            </Field>
            <Field label="Address line 2" htmlFor="businessAddress2">
              <Input
                id="businessAddress2"
                name="businessAddress2"
                defaultValue={organization?.address_2 ?? ""}
              />
            </Field>
            <Field label="City" htmlFor="city" required error={errors.city}>
              <Input id="city" name="city" defaultValue={organization?.city ?? ""} />
            </Field>
            <Field label="State" htmlFor="state" required error={errors.state}>
              <Select id="state" name="state" defaultValue={organization?.state ?? "MA"}>
                {US_STATES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Postal code" htmlFor="postalCode" required error={errors.postalCode}>
              <Input
                id="postalCode"
                name="postalCode"
                defaultValue={organization?.postal_code ?? ""}
              />
            </Field>
          </div>
        </div>

        <input type="hidden" name="country" value={DEFAULT_COUNTRY} />

        <div className="mt-5">
          <CheckboxRow
            name="acceptingNewClients"
            value="true"
            label="I am currently accepting new clients"
            defaultChecked={profile.accepting_new_clients ?? true}
          />
        </div>
      </Card>

      <Callout tone="info" title="Not collected yet">
        We do not ask for SSN, EIN, W-9 or banking details during onboarding. Payout and
        tax setup comes later, once the commercial model is finalized.
      </Callout>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}

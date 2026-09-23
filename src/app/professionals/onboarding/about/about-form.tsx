"use client";

import { useActionState, useState } from "react";
import { DocumentUpload, type UploadedDocument } from "@/components/document-upload";
import {
  Button,
  Callout,
  Card,
  CheckboxRow,
  Field,
  Input,
  RadioRow,
  SectionHeading,
  Textarea,
} from "@/components/ui";
import { saveAboutYou } from "@/lib/actions/onboarding";
import { idleState } from "@/lib/actions/state";
import type { ProfessionalProfileRow } from "@/lib/data/types";
import {
  JOINING_AS,
  JOINING_AS_DESCRIPTIONS,
  JOINING_AS_LABELS,
  LANGUAGES,
  PROFESSION_LABELS,
  PROFESSION_TYPES,
} from "@/lib/domain/enums";

export function AboutForm({
  profile,
  defaultEmail,
  photo,
}: {
  profile: ProfessionalProfileRow;
  defaultEmail: string;
  photo: { id: string; original_filename: string } | null;
}) {
  const [state, formAction, pending] = useActionState(saveAboutYou, idleState);
  const [photoDocument, setPhotoDocument] = useState<UploadedDocument | null>(photo);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <SectionHeading
        title="About you"
        description="This is what DexaFit customers will see when you are matched to their scan results."
      />

      {state.message && !state.ok ? <Callout tone="danger">{state.message}</Callout> : null}

      <Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Legal first name" htmlFor="legalFirstName" required error={errors.legalFirstName}>
            <Input
              id="legalFirstName"
              name="legalFirstName"
              defaultValue={profile.legal_first_name ?? ""}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Legal last name" htmlFor="legalLastName" required error={errors.legalLastName}>
            <Input
              id="legalLastName"
              name="legalLastName"
              defaultValue={profile.legal_last_name ?? ""}
              maxLength={100}
              required
            />
          </Field>
          <Field
            label="Display name"
            htmlFor="displayName"
            required
            hint="How your name appears on the marketplace."
            error={errors.displayName}
          >
            <Input
              id="displayName"
              name="displayName"
              defaultValue={profile.display_name ?? ""}
              required
            />
          </Field>
          <Field label="Professional title" htmlFor="professionalTitle" required error={errors.professionalTitle}>
            <Input
              id="professionalTitle"
              name="professionalTitle"
              placeholder="e.g. NSCA-CSCS, Recomp specialist"
              defaultValue={profile.professional_title ?? ""}
              required
            />
          </Field>
          <Field label="Email" htmlFor="email" required error={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={defaultEmail} required />
          </Field>
          <Field label="Phone" htmlFor="phone" required error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ""}
              placeholder="+1 617 555 0123"
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Are you joining as an individual or through a practice?"
              required
              hint="This decides what we ask for later — an individual holds their own insurance, a practice has its own legal details."
              error={errors.joiningAs}
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {JOINING_AS.map((option) => (
                  <RadioRow
                    key={option}
                    name="joiningAs"
                    value={option}
                    label={JOINING_AS_LABELS[option]}
                    description={JOINING_AS_DESCRIPTIONS[option]}
                    defaultChecked={(profile.joining_as ?? "INDIVIDUAL") === option}
                  />
                ))}
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              label="What do you do?"
              required
              hint="Select everything you are qualified for. We will ask for the credentials each one needs — holding two qualifications means two sets of credentials, not one."
              error={errors.professionTypes}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {PROFESSION_TYPES.map((type) => (
                  <CheckboxRow
                    key={type}
                    name="professionTypes"
                    value={type}
                    label={PROFESSION_LABELS[type]}
                    defaultChecked={profile.profession_types.includes(type)}
                  />
                ))}
              </div>
            </Field>
          </div>
          <Field label="Years of experience" htmlFor="yearsExperience" required error={errors.yearsExperience}>
            <Input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              max={80}
              defaultValue={profile.years_experience ?? ""}
              required
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <Field
            label="Bio"
            htmlFor="bio"
            required
            hint="100–1000 characters. How you work, who you help, and what results you focus on."
            error={errors.bio}
          >
            <Textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              minLength={100}
              maxLength={1000}
              required
            />
          </Field>

          <Field label="Languages" required error={errors.languages}>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((language) => (
                <label
                  key={language}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-slate-50 has-checked:border-accent has-checked:bg-emerald-50"
                >
                  <input
                    type="checkbox"
                    name="languages"
                    value={language}
                    defaultChecked={profile.languages?.includes(language)}
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  {language}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Profile photo" required hint="JPG, PNG or WebP.">
            <DocumentUpload
              name="profilePhotoDocumentId"
              documentType="PROFILE_PHOTO"
              required
              value={photoDocument}
              onChange={setPhotoDocument}
              label="Upload photo"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-ink">Links (optional)</p>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Website" htmlFor="websiteUrl" error={errors.websiteUrl}>
            <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={profile.website_url ?? ""} />
          </Field>
          <Field label="LinkedIn" htmlFor="linkedinUrl" error={errors.linkedinUrl}>
            <Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={profile.linkedin_url ?? ""} />
          </Field>
          <Field label="Instagram" htmlFor="instagramUrl" error={errors.instagramUrl}>
            <Input id="instagramUrl" name="instagramUrl" type="url" defaultValue={profile.instagram_url ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}

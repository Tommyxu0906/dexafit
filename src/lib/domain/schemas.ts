import { z } from "zod";
import {
  APRN_CATEGORIES,
  CREDENTIAL_TYPES,
  DISCLOSURE_TYPES,
  INSURANCE_TYPES,
  JOINING_AS,
  PROFESSION_TYPES,
  SERVICE_MODES,
} from "./enums";

/**
 * A field the wizard renders conditionally is absent from the submitted form,
 * and `FormData.get` reports absence as `null` rather than `undefined`. Treat
 * both — and the empty string — as "not provided", or hiding a field turns into
 * a validation error the user cannot see or fix.
 */
const absentToUndefined = (value: unknown) =>
  value === null || value === "" ? undefined : value;

const optionalText = z.preprocess(
  absentToUndefined,
  z.string().trim().max(500).optional(),
);

const optionalUrl = z.preprocess(
  absentToUndefined,
  z.string().trim().url("Must be a valid URL").optional(),
);

/**
 * Absent becomes the empty string rather than undefined, so a missing field
 * fails on `min(1)` with the message written for a human instead of Zod's
 * "expected string, received undefined".
 */
const requiredText = (message: string) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? "" : value),
    z.string().trim().min(1, message).max(500),
  );

/** Loose E.164-ish check; normalization happens before persistence. */
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20)
  .regex(/^[+0-9().\-\s]+$/, "Enter a valid phone number");

export const aboutYouSchema = z.object({
  legalFirstName: z.string().trim().min(1, "Required").max(100),
  legalLastName: z.string().trim().min(1, "Required").max(100),
  displayName: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone,
  professionalTitle: z.string().trim().min(1, "Required").max(120),
  // A professional may hold several qualifications at once; the required
  // credentials are the union across all of them.
  // Asked in step 1 rather than step 2: whether someone is an individual or
  // part of a clinic decides what the rest of the wizard has to collect, and
  // finding out late means asking questions that turn out not to apply.
  joiningAs: z.enum(JOINING_AS),
  professionTypes: z
    .array(z.enum(PROFESSION_TYPES))
    .min(1, "Select at least one")
    .max(PROFESSION_TYPES.length),
  yearsExperience: z.coerce.number().int().min(0, "Must be 0 or more").max(80),
  bio: z
    .string()
    .trim()
    .min(100, "Please write at least 100 characters")
    .max(1000, "Maximum 1000 characters"),
  languages: z.array(z.string().trim().min(1)).min(1, "Select at least one language"),
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  instagramUrl: optionalUrl,
});

export type AboutYouInput = z.infer<typeof aboutYouSchema>;

export const practiceSchema = z
  .object({
    // Carried from step 1, not re-asked. The form posts it back so validation
    // can branch on it; the stored profile is what the server trusts.
    joiningAs: z.enum(JOINING_AS),
    practiceName: optionalText,
    organizationLegalName: optionalText,
    organizationDba: optionalText,
    businessEmail: z.string().trim().email("Enter a valid email"),
    businessPhone: phone,
    businessWebsite: optionalUrl,
    // A business address is required of every provider, including virtual-only
    // ones: it is what identity verification, legal contact and dispute handling
    // rest on, and step 7 covers service geography separately.
    businessAddress1: requiredText("Required"),
    businessAddress2: optionalText,
    city: requiredText("Required"),
    state: requiredText("Select a state"),
    postalCode: requiredText("Required"),
    country: z.string().trim().min(2).max(2),
    serviceModes: z.array(z.enum(SERVICE_MODES)).min(1, "Select at least one"),
    acceptingNewClients: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const partOfOrg = value.joiningAs !== "INDIVIDUAL";
    if (partOfOrg && !value.organizationLegalName) {
      ctx.addIssue({
        code: "custom",
        path: ["organizationLegalName"],
        message: "Required when joining as part of an organization",
      });
    }
  });

export type PracticeInput = z.infer<typeof practiceSchema>;

export const credentialSchema = z.object({
  id: z.string().uuid().optional(),
  credentialType: z.enum(CREDENTIAL_TYPES),
  requirementKey: requiredText("Which requirement this satisfies is missing"),
  credentialName: z.string().trim().min(1, "Required").max(200),
  credentialNumber: optionalText,
  issuingAuthority: optionalText,
  jurisdictionCountry: z.string().trim().min(2).max(2).default("US"),
  jurisdictionState: optionalText,
  issueDate: optionalText,
  expirationDate: optionalText,
  documentId: z.string().uuid().optional(),
});

export type CredentialInput = z.infer<typeof credentialSchema>;

export const credentialExtrasSchema = z.object({
  holdsRdRdn: z.boolean().optional(),
  aprnCategory: z.enum(APRN_CATEGORIES).optional(),
  scopeAcknowledged: z.boolean().optional(),
});

export type CredentialExtrasInput = z.infer<typeof credentialExtrasSchema>;

export const insuranceSchema = z.object({
  id: z.string().uuid().optional(),
  insuranceType: z.enum(INSURANCE_TYPES),
  carrierName: z.string().trim().min(1, "Required").max(200),
  policyNumber: z.string().trim().min(1, "Required").max(100),
  // Amounts are collected but no minimum is enforced pending marketplace policy.
  coveragePerClaim: z.coerce.number().nonnegative().optional(),
  coverageAggregate: z.coerce.number().nonnegative().optional(),
  effectiveDate: z.string().trim().min(1, "Required"),
  expirationDate: z.string().trim().min(1, "Required"),
  // Carrier, policy number and dates stay required: entering them is the
  // provider's declaration that the cover exists, and that declaration is what
  // DexaFit relies on. The certificate itself is optional — uploading a COI was
  // one of the heaviest asks in onboarding, and DexaFit chose to require the
  // cover without requiring the paperwork. Anything verified without a
  // certificate is verified against the provider's word, which is why the
  // review screen says so rather than leaving the reviewer to notice.
  certificateDocumentId: z.string().uuid().optional(),
});

export type InsuranceInput = z.infer<typeof insuranceSchema>;

export const disclosureSchema = z
  .object({
    disclosureType: z.enum(DISCLOSURE_TYPES),
    answer: z.boolean(),
    explanation: optionalText,
    supportingDocumentId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.answer && !value.explanation) {
      ctx.addIssue({
        code: "custom",
        path: ["explanation"],
        message: "An explanation is required",
      });
    }
  });

export const disclosuresSchema = z.object({
  disclosures: z.array(disclosureSchema).length(DISCLOSURE_TYPES.length),
});

export const capabilitiesSchema = z.object({
  clientPopulations: z.array(z.string()).min(1, "Select at least one"),
  dexaCapabilities: z.array(z.string()).min(1, "Select at least one"),
});

export type CapabilitiesInput = z.infer<typeof capabilitiesSchema>;

export const serviceOfferingSchema = z
  .object({
    id: z.string().uuid().optional(),
    serviceName: z.string().trim().min(1, "Required").max(150),
    serviceDescription: z.string().trim().min(1, "Required").max(1000),
    serviceCategory: z.string().trim().min(1, "Required").max(100),
    modality: z.enum(SERVICE_MODES),
    durationMinutes: z.coerce.number().int().positive("Must be greater than 0"),
    priceAmount: z.coerce.number().nonnegative().optional(),
    freeIntroConsult: z.boolean(),
    bookingUrl: optionalUrl,
    acceptsSelfPay: z.boolean(),
    acceptsInsurance: z.boolean(),
    insuranceNotes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.acceptsInsurance && !value.insuranceNotes) {
      ctx.addIssue({
        code: "custom",
        path: ["insuranceNotes"],
        message: "Tell clients which plans you accept",
      });
    }
  });

export type ServiceOfferingInput = z.infer<typeof serviceOfferingSchema>;

export const serviceLocationSchema = z.object({
  id: z.string().uuid().optional(),
  country: z.string().trim().min(2).max(2),
  state: z.string().trim().min(2, "Required").max(2),
  city: optionalText,
  postalCode: optionalText,
  address1: optionalText,
  address2: optionalText,
  serviceMode: z.enum(SERVICE_MODES),
});

export type ServiceLocationInput = z.infer<typeof serviceLocationSchema>;

export const jurisdictionSchema = z.object({
  country: z.string().trim().min(2).max(2),
  state: z.string().trim().min(2).max(2),
  credentialId: z.string().uuid().optional(),
  virtualAllowed: z.boolean(),
  inPersonAllowed: z.boolean(),
});

export type JurisdictionInput = z.infer<typeof jurisdictionSchema>;

export const attestationsSchema = z.object({
  acceptedTypes: z.array(z.string()).min(1),
  electronicSignature: z.string().trim().min(2, "Type your full legal name"),
  signatureDate: z.string().trim().min(1, "Required"),
});

export type AttestationsInput = z.infer<typeof attestationsSchema>;

import { describe, expect, it } from "vitest";
import {
  aboutYouSchema,
  credentialSchema,
  insuranceSchema,
  practiceSchema,
  serviceOfferingSchema,
} from "../schemas";

/**
 * The wizard hides whole groups of fields depending on earlier answers, and a
 * hidden input is simply absent from the FormData. These cover that shape —
 * `null` for every field the browser never rendered.
 */
function virtualOnlyPractice(overrides: Record<string, unknown> = {}) {
  return {
    joiningAs: "INDIVIDUAL",
    practiceName: null,
    organizationLegalName: null,
    organizationDba: null,
    businessEmail: "coach@example.com",
    businessPhone: "+16175550123",
    businessWebsite: null,
    businessAddress1: "1 Main St",
    businessAddress2: null,
    city: "Boston",
    state: "MA",
    postalCode: "02110",
    country: "US",
    serviceModes: ["VIRTUAL"],
    acceptingNewClients: true,
    ...overrides,
  };
}

describe("absent conditional fields", () => {
  it("accepts a practice whose optional fields were never rendered", () => {
    const result = practiceSchema.safeParse(virtualOnlyPractice());
    expect(result.success).toBe(true);
  });

  it("never surfaces a raw type error for an unrendered field", () => {
    const result = practiceSchema.safeParse(virtualOnlyPractice());
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).not.toMatch(/expected string, received null/i);
    }
  });
});

describe("business address", () => {
  // Every provider gives a business address: it backs identity verification and
  // legal contact, which a virtual-only practice needs just as much.
  for (const mode of ["VIRTUAL", "IN_PERSON", "HYBRID"] as const) {
    it(`is required for a ${mode.toLowerCase()} practice`, () => {
      const result = practiceSchema.safeParse(
        virtualOnlyPractice({
          serviceModes: [mode],
          businessAddress1: null,
          city: null,
          postalCode: null,
        }),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join("."));
        expect(paths).toContain("businessAddress1");
        expect(paths).toContain("city");
        expect(paths).toContain("postalCode");
        // Readable guidance, not Zod's internal type complaint.
        const messages = result.error.issues.map((i) => i.message).join(" ");
        expect(messages).not.toMatch(/expected string, received/i);
      }
    });
  }

  it("accepts a complete address", () => {
    expect(practiceSchema.safeParse(virtualOnlyPractice()).success).toBe(true);
  });

  it("requires an organization name only when joining through one", () => {
    expect(practiceSchema.safeParse(virtualOnlyPractice()).success).toBe(true);

    const asMember = practiceSchema.safeParse(
      virtualOnlyPractice({ joiningAs: "ORGANIZATION_MEMBER" }),
    );
    expect(asMember.success).toBe(false);
    if (!asMember.success) {
      expect(
        asMember.error.issues.some((i) => i.path.includes("organizationLegalName")),
      ).toBe(true);
    }
  });

  it("accepts an absent optional URL but rejects a malformed one", () => {
    expect(practiceSchema.safeParse(virtualOnlyPractice()).success).toBe(true);
    expect(
      practiceSchema.safeParse(virtualOnlyPractice({ businessWebsite: "not a url" }))
        .success,
    ).toBe(false);
    expect(
      practiceSchema.safeParse(
        virtualOnlyPractice({ businessWebsite: "https://example.com" }),
      ).success,
    ).toBe(true);
  });

  it("accepts a credential with no jurisdiction field rendered", () => {
    const result = credentialSchema.safeParse({
      credentialType: "CPR_AED",
      requirementKey: "CPR_AED",
      credentialName: "CPR/AED",
      credentialNumber: null,
      issuingAuthority: null,
      jurisdictionCountry: "US",
      jurisdictionState: null,
      issueDate: null,
      expirationDate: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a service whose insurance notes were never rendered", () => {
    const result = serviceOfferingSchema.safeParse({
      serviceName: "Initial consult",
      serviceDescription: "A first session.",
      serviceCategory: "Consultation",
      productType: "IN_PERSON_SERVICE",
      modality: "VIRTUAL",
      durationMinutes: 45,
      priceAmount: undefined,
      freeIntroConsult: false,
      bookingUrl: null,
      acceptsSelfPay: true,
      acceptsInsurance: false,
      insuranceNotes: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("step 1 asks the questions the rest of the wizard branches on", () => {
  const about = (overrides: Record<string, unknown> = {}) => ({
    legalFirstName: "Priya",
    legalLastName: "Raghunathan",
    displayName: "Priya Raghunathan",
    email: "priya@example.com",
    phone: "+16175550184",
    professionalTitle: "PT, RD",
    joiningAs: "INDIVIDUAL",
    professionTypes: ["PHYSICAL_THERAPIST"],
    yearsExperience: "16",
    bio: "x".repeat(150),
    languages: ["English"],
    ...overrides,
  });

  it("accepts a complete step 1", () => {
    expect(aboutYouSchema.safeParse(about()).success).toBe(true);
  });

  it("requires the individual-or-practice answer up front", () => {
    // Asking this in step 2 meant step 1 could complete without knowing which
    // later questions even apply.
    const result = aboutYouSchema.safeParse(about({ joiningAs: undefined }));
    expect(result.success).toBe(false);
  });

  it("refuses an empty profession selection rather than assuming one", () => {
    const result = aboutYouSchema.safeParse(about({ professionTypes: [] }));
    expect(result.success).toBe(false);
  });

  it("accepts someone who practises more than one profession", () => {
    const result = aboutYouSchema.safeParse(
      about({ professionTypes: ["PHYSICAL_THERAPIST", "DIETITIAN_NUTRITIONIST"] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a profession that is not on the list", () => {
    // The mental-health professions were removed; a stale client must not be
    // able to post one back.
    const result = aboutYouSchema.safeParse(about({ professionTypes: ["LICSW"] }));
    expect(result.success).toBe(false);
  });
});

describe("insurance is required, its certificate is not", () => {
  // DexaFit requires providers to carry cover but decided not to require the
  // certificate: the COI upload was one of the heaviest asks in onboarding.
  // What that means precisely is that the *declaration* stays mandatory and
  // only the paperwork is optional, so the policy fields must not go soft.
  const policy = {
    insuranceType: "PROFESSIONAL_LIABILITY" as const,
    carrierName: "Acme Mutual",
    policyNumber: "POL-1",
    effectiveDate: "2026-01-01",
    expirationDate: "2027-01-01",
  };

  it("accepts a policy with no certificate attached", () => {
    expect(insuranceSchema.safeParse(policy).success).toBe(true);
    // An untouched file input arrives as undefined, not as "".
    expect(
      insuranceSchema.safeParse({ ...policy, certificateDocumentId: undefined }).success,
    ).toBe(true);
  });

  it("still demands the details that make up the declaration", () => {
    for (const field of [
      "carrierName",
      "policyNumber",
      "effectiveDate",
      "expirationDate",
    ] as const) {
      const result = insuranceSchema.safeParse({ ...policy, [field]: "" });
      expect(result.success, `${field} became optional along with the certificate`).toBe(
        false,
      );
    }
  });

  it("does not accept nonsense in place of a certificate id", () => {
    // Optional must not degrade into unvalidated. A non-uuid here would mean a
    // policy pointing at a document that cannot exist.
    expect(
      insuranceSchema.safeParse({ ...policy, certificateDocumentId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("a product is not always an appointment", () => {
  // Products left onboarding and became their own thing. A provider may sell a
  // session, an item bought outright, or a service delivered some other way,
  // and only the first two kinds have a length.
  const product = (overrides: Record<string, unknown> = {}) => ({
    serviceName: "Body composition consult",
    serviceDescription: "A first session.",
    serviceCategory: "Consultation",
    productType: "IN_PERSON_SERVICE",
    modality: "IN_PERSON",
    durationMinutes: 45,
    freeIntroConsult: false,
    bookingUrl: null,
    acceptsSelfPay: true,
    acceptsInsurance: false,
    insuranceNotes: null,
    ...overrides,
  });

  it("requires a duration for a booked session", () => {
    const result = serviceOfferingSchema.safeParse(
      product({ productType: "IN_PERSON_SERVICE", durationMinutes: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("does not require one for something bought outright", () => {
    // Demanding a number here would put "60 min" on the listing for a T-shirt.
    const result = serviceOfferingSchema.safeParse(
      product({ productType: "ECOMMERCE", durationMinutes: undefined }),
    );
    expect(result.success).toBe(true);
  });

  it("still requires a product type", () => {
    expect(
      serviceOfferingSchema.safeParse(product({ productType: undefined })).success,
    ).toBe(false);
    expect(
      serviceOfferingSchema.safeParse(product({ productType: "NONSENSE" })).success,
    ).toBe(false);
  });
});

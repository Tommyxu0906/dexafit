import { describe, expect, it } from "vitest";
import {
  credentialSchema,
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

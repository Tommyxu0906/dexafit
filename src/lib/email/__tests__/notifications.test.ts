import { afterEach, describe, expect, it, vi } from "vitest";
import { readEmailConfig, type EmailEnv } from "../config";
import { CONFIDENTIALITY_FOOTER, buildSubmissionNotification } from "../notifications";
import { sendEmail, type EmailMessage } from "../send";

const VALID_ENV: EmailEnv = {
  RESEND_API_KEY: "re_test_key",
  ADMIN_NOTIFICATION_EMAILS: "admin@example.com",
};

const MESSAGE: EmailMessage = {
  to: ["admin@example.com"],
  subject: "subject",
  text: "text",
  html: "<p>html</p>",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readEmailConfig", () => {
  it("reports the missing API key rather than half-configuring itself", () => {
    const result = readEmailConfig({ ADMIN_NOTIFICATION_EMAILS: "a@b.com" });
    expect(result.configured).toBe(false);
    expect(result.configured === false && result.reason).toContain("RESEND_API_KEY");
  });

  it("refuses to consider itself configured with nobody to notify", () => {
    const result = readEmailConfig({ RESEND_API_KEY: "re_x" });
    expect(result.configured).toBe(false);
    expect(result.configured === false && result.reason).toContain(
      "ADMIN_NOTIFICATION_EMAILS",
    );
  });

  it("ignores entries that are not addresses instead of mailing them", () => {
    const result = readEmailConfig({
      RESEND_API_KEY: "re_x",
      ADMIN_NOTIFICATION_EMAILS: " one@dexafit.com , not-an-address ,two@dexafit.com ",
    });

    expect(result.configured).toBe(true);
    expect(result.configured && result.config.adminRecipients).toEqual([
      "one@dexafit.com",
      "two@dexafit.com",
    ]);
  });

  it("normalises a trailing slash so review links never come out doubled", () => {
    const result = readEmailConfig({
      ...VALID_ENV,
      APP_URL: "https://app.dexafit.com/",
    });

    expect(result.configured && result.config.appUrl).toBe("https://app.dexafit.com");
  });
});

describe("buildSubmissionNotification", () => {
  const base = {
    applicationId: "app-123",
    applicantName: "Jane Doe",
    professionLabel: "Personal trainer",
    jurisdictionState: "MA",
    contactEmail: "jane@example.com",
    submittedAt: new Date("2026-09-17T19:04:00Z"),
    manualReviewRequired: false,
  };

  it("links to the review page for that application", () => {
    const message = buildSubmissionNotification(base, "https://app.dexafit.com");
    const link = "https://app.dexafit.com/admin/professionals/app-123";
    expect(message.text).toContain(link);
    expect(message.html).toContain(link);
  });

  it("says in the subject when submission already flagged manual review", () => {
    expect(buildSubmissionNotification(base, "https://x.com").subject).not.toContain(
      "manual review",
    );
    expect(
      buildSubmissionNotification(
        { ...base, manualReviewRequired: true },
        "https://x.com",
      ).subject,
    ).toContain("manual review");
  });

  it("lets the reviewer reply straight to the applicant", () => {
    expect(buildSubmissionNotification(base, "https://x.com").replyTo).toBe(
      "jane@example.com",
    );
    expect(
      buildSubmissionNotification({ ...base, contactEmail: null }, "https://x.com").replyTo,
    ).toBeUndefined();
  });

  it("escapes a hostile display name instead of injecting it into the email", () => {
    const message = buildSubmissionNotification(
      { ...base, applicantName: `<script>alert("x")</script>` },
      "https://x.com",
    );

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
  });

  it("carries no credential, document or disclosure detail", () => {
    // Email is not a confidential channel. The composer only ever receives the
    // fields below, and this guards the body against picking up more later.
    const message = buildSubmissionNotification(base, "https://x.com");
    const body = `${message.subject}\n${message.text}\n${message.html}`
      .split(CONFIDENTIALITY_FOOTER)
      .join("")
      .toLowerCase();

    for (const forbidden of ["licen", "credential", "disclosure", "policy"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("renders the submission time in Eastern rather than falling back to ISO", () => {
    // `timeZoneName` with `dateStyle`/`timeStyle` throws, and the fallback would
    // hide it — assert the formatted result, not merely that nothing threw.
    const message = buildSubmissionNotification(base, "https://x.com");
    expect(message.text).toContain("Sep 17, 2026, 3:04 PM EDT");
  });
});

describe("sendEmail", () => {
  it("does not call out to the network when there is no API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await sendEmail(MESSAGE, {});

    expect(result.status).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the message to Resend with the configured sender", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
    );

    const result = await sendEmail(MESSAGE, {
      ...VALID_ENV,
      EMAIL_FROM: "DexaFit <onboarding@dexafit.com>",
    });

    expect(result).toEqual({ status: "sent", id: "email-1" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_key",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "DexaFit <onboarding@dexafit.com>",
      to: ["admin@example.com"],
      subject: "subject",
    });
  });

  it("reports a rejected send instead of throwing into the submission", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "domain is not verified" }), { status: 403 }),
    );

    const result = await sendEmail(MESSAGE, VALID_ENV);

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("domain is not verified");
  });

  it("survives a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("socket hang up"));

    const result = await sendEmail(MESSAGE, VALID_ENV);

    expect(result).toEqual({ status: "failed", reason: "socket hang up" });
  });

  it("survives a response that is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    );

    const result = await sendEmail(MESSAGE, VALID_ENV);

    expect(result.status).toBe("failed");
  });
});

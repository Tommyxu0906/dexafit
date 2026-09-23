import {
  EXPIRY_WARNING_DAYS,
  describeTimeToExpiry,
  type ExpiringItemKind,
} from "../domain/expiry";
import { readEmailConfig } from "./config";
import { renderEmailBody } from "./layout";
import { sendEmail, type EmailMessage, type SendResult } from "./send";

/**
 * Transactional email sent to a provider about their own application.
 *
 * Two rules govern everything in this file.
 *
 * 1. The recipient is always the confirmed Supabase Auth address, resolved by
 *    `resolveVerifiedProviderEmail`. Never `professional_profiles.email`.
 *
 * 2. The body carries no credential numbers, document names, insurance policy
 *    numbers, compliance disclosure answers or signed document URLs. A provider
 *    already has all of that behind their login; putting any of it in a mailbox
 *    adds risk and buys nothing. Where there is something specific to say, the
 *    email says that there is and links to the status page.
 *
 * Reviewer notes are deliberately excluded too. The decision form labels that
 * field "Note to the applicant", but the same column is written by other review
 * paths, and a reviewer typing into a box has no way to know their words are
 * about to leave the system. The status page shows the note; the email points
 * at the status page.
 */

export type ProviderNotificationType =
  | "SUBMITTED"
  | "INFORMATION_REQUESTED"
  | "APPROVED"
  | "REJECTED";

export type ProviderNotification = {
  type: ProviderNotificationType;
  providerName: string;
  professionLabel: string | null;
};

const STATUS_PAGE = "/professionals/onboarding/status";
const CREDENTIALS_PAGE = "/professionals/onboarding/credentials";

export function buildProviderNotification(
  input: ProviderNotification,
  appUrl: string,
  supportEmail?: string,
): Omit<EmailMessage, "to"> {
  const statusUrl = `${appUrl}${STATUS_PAGE}`;
  const greeting = `Hi ${input.providerName},`;
  const content = PROVIDER_COPY[input.type];

  const { text, html } = renderEmailBody({
    paragraphs: [greeting, ...content.paragraphs],
    cta: { label: content.ctaLabel, url: statusUrl },
    footer: content.footer,
  });

  // The rejection copy invites a reply, so it must actually reach someone.
  return { subject: content.subject, text, html, replyTo: supportEmail };
}

const PROVIDER_COPY: Record<
  ProviderNotificationType,
  { subject: string; paragraphs: string[]; ctaLabel: string; footer?: string }
> = {
  SUBMITTED: {
    subject: "We received your DexaFit application",
    paragraphs: [
      "Thanks for applying to the DexaFit professional marketplace. Your application is in, and a member of our credentialing team will begin verifying your credentials.",
      "You do not need to do anything right now. We will email you if we need more information, and again once a decision is made.",
    ],
    ctaLabel: "View your application status",
  },
  INFORMATION_REQUESTED: {
    subject: "We need more information about your DexaFit application",
    paragraphs: [
      "We have reviewed your application and need some additional information before we can continue.",
      "The details of what we need are on your application status page, along with the note from our reviewer. You can update your application from there, and it will return to the review queue automatically once you do.",
    ],
    ctaLabel: "See what we need",
  },
  APPROVED: {
    subject: "Your DexaFit application is approved",
    paragraphs: [
      "Good news — your application has been approved and your profile is now eligible for the DexaFit marketplace.",
      "Keep your credentials and insurance current in your profile. If any of them lapse or you change them, your listing returns to review until we have verified the update.",
    ],
    ctaLabel: "View your profile",
  },
  REJECTED: {
    subject: "An update on your DexaFit application",
    paragraphs: [
      "Thank you for your interest in the DexaFit professional marketplace. After review, we are not able to approve your application at this time.",
      "Your status page has the reviewer's note explaining the decision. If you believe something was missed or your circumstances change, reply to this email and we will take another look.",
    ],
    ctaLabel: "View the decision",
  },
};

/**
 * Notifies a provider about their own application.
 *
 * Like every send in this codebase, this reports rather than throws: the state
 * transition it describes has already been committed, and no mail problem may
 * undo it. The failure is logged so it is visible rather than silent.
 */
export async function notifyProvider(
  recipient: string,
  input: ProviderNotification,
): Promise<SendResult> {
  const configResult = readEmailConfig();
  if (!configResult.configured) {
    console.warn(
      `[email] ${input.type} notification not sent to the provider: ${configResult.reason}`,
    );
    return { status: "skipped", reason: configResult.reason };
  }

  const message = buildProviderNotification(
    input,
    configResult.config.appUrl,
    configResult.config.supportEmail,
  );
  const result = await sendEmail({ ...message, to: [recipient] });

  if (result.status === "failed") {
    console.error(
      `[email] ${input.type} notification to the provider failed: ${result.reason}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Expiry warnings
// ---------------------------------------------------------------------------

export type ExpiringItemSummary = {
  kind: ExpiringItemKind;
  label: string;
  expirationDate: string;
};

export type ExpiryWarning = {
  providerName: string;
  items: readonly ExpiringItemSummary[];
};

/**
 * Advance notice that something is about to lapse.
 *
 * Labels and dates only — the same rule as every other provider email. A
 * provider needs to know *which* credential to renew, not to be sent its number
 * back. What happens when it does lapse is not stated, because that has not
 * been decided; promising a consequence we have not agreed would be worse than
 * saying nothing.
 */
export function buildExpiryWarning(
  input: ExpiryWarning,
  appUrl: string,
  supportEmail: string | undefined,
  now: Date,
): Omit<EmailMessage, "to"> {
  const soonest = [...input.items].sort((a, b) =>
    a.expirationDate.localeCompare(b.expirationDate),
  )[0];

  const subject =
    input.items.length === 1
      ? `Your ${input.items[0].label} expires ${describeTimeToExpiry(soonest.expirationDate, now)}`
      : `${input.items.length} of your credentials expire in the next ${EXPIRY_WARNING_DAYS} days`;

  const { text, html } = renderEmailBody({
    paragraphs: [
      `Hi ${input.providerName},`,
      input.items.length === 1
        ? "One of the credentials on your DexaFit profile is coming up for renewal."
        : "Some of the credentials on your DexaFit profile are coming up for renewal.",
      "Once you have renewed, update the expiry date on your profile and upload the new document. We will verify it and nothing about your listing changes.",
    ],
    rows: input.items.map(
      (item) =>
        [
          item.label,
          `expires ${item.expirationDate} (${describeTimeToExpiry(item.expirationDate, now)})`,
        ] as [string, string],
    ),
    cta: { label: "Update my credentials", url: `${appUrl}${CREDENTIALS_PAGE}` },
    footer:
      "If you have already renewed, no action is needed beyond updating the date on your profile.",
  });

  return { subject, text, html, replyTo: supportEmail };
}

export async function notifyProviderOfExpiry(
  recipient: string,
  input: ExpiryWarning,
  now: Date = new Date(),
): Promise<SendResult> {
  const configResult = readEmailConfig();
  if (!configResult.configured) {
    console.warn(`[email] Expiry warning not sent: ${configResult.reason}`);
    return { status: "skipped", reason: configResult.reason };
  }

  const message = buildExpiryWarning(
    input,
    configResult.config.appUrl,
    configResult.config.supportEmail,
    now,
  );
  const result = await sendEmail({ ...message, to: [recipient] });

  if (result.status === "failed") {
    console.error(`[email] Expiry warning failed: ${result.reason}`);
  }

  return result;
}

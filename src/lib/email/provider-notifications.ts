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

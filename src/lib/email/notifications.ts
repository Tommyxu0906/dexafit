import { readEmailConfig } from "./config";
import { formatEastern, renderEmailBody } from "./layout";
import { sendEmail, type EmailMessage, type SendResult } from "./send";

/** Fixed footer copy, shared so a test can scan the rest of the body for leaks. */
export const CONFIDENTIALITY_FOOTER =
  "Credential numbers, uploaded documents and compliance answers are left out of this email on purpose — open the review page to see them.";

export type SubmissionNotification = {
  applicationId: string;
  applicantName: string;
  professionLabel: string;
  jurisdictionState: string;
  contactEmail: string | null;
  submittedAt: Date;
  manualReviewRequired: boolean;
};

/**
 * Email is not a confidential channel, so a notification carries only what a
 * reviewer needs to decide whether to open the queue now: who applied, in what
 * profession and state, and whether submission already flagged manual review.
 *
 * Licence numbers, uploaded documents and compliance disclosure answers stay
 * behind the admin login.
 */
export function buildSubmissionNotification(
  input: SubmissionNotification,
  appUrl: string,
): Omit<EmailMessage, "to"> {
  const reviewUrl = `${appUrl}/admin/professionals/${input.applicationId}`;
  const submitted = formatEastern(input.submittedAt);

  const subject = input.manualReviewRequired
    ? `New provider application (manual review) — ${input.applicantName}`
    : `New provider application — ${input.applicantName}`;

  const rows: Array<[string, string]> = [
    ["Name", input.applicantName],
    ["Profession", input.professionLabel],
    ["Jurisdiction", input.jurisdictionState],
    ["Contact", input.contactEmail ?? "not provided"],
    ["Submitted", submitted],
    [
      "Manual review",
      input.manualReviewRequired ? "Yes — flagged at submission" : "No",
    ],
  ];

  const { text, html } = renderEmailBody({
    paragraphs: ["A professional submitted their DexaFit onboarding application."],
    rows,
    cta: { label: "Open the review page", url: reviewUrl },
    footer: CONFIDENTIALITY_FOOTER,
  });

  return { subject, text, html, replyTo: input.contactEmail ?? undefined };
}

/**
 * Notifies the credentialing admins that an application arrived.
 *
 * Returns the outcome instead of throwing: the submission it describes has
 * already been written, and no email problem may undo or fail that.
 */
export async function notifyAdminsOfSubmission(
  input: SubmissionNotification,
): Promise<SendResult> {
  const configResult = readEmailConfig();
  if (!configResult.configured) {
    console.warn(
      `[email] Submission notification not sent for application ${input.applicationId}: ${configResult.reason}`,
    );
    return { status: "skipped", reason: configResult.reason };
  }

  const { adminRecipients, appUrl } = configResult.config;
  const message = buildSubmissionNotification(input, appUrl);
  const result = await sendEmail({ ...message, to: adminRecipients });

  if (result.status === "failed") {
    console.error(
      `[email] Submission notification failed for application ${input.applicationId}: ${result.reason}`,
    );
  } else if (result.status === "sent") {
    console.info(
      `[email] Notified ${adminRecipients.join(", ")} about application ${input.applicationId} (${result.id}).`,
    );
  }

  return result;
}



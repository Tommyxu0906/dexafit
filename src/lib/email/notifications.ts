import { readEmailConfig } from "./config";
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

  const text = [
    "A professional submitted their DexaFit onboarding application.",
    "",
    ...rows.map(([label, value]) => `${label.padEnd(14)}${value}`),
    "",
    "Review it here:",
    reviewUrl,
    "",
    CONFIDENTIALITY_FOOTER,
  ].join("\n");

  const html = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">`,
    `<p>A professional submitted their DexaFit onboarding application.</p>`,
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">`,
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="padding:2px 16px 2px 0;color:#64748b">${escapeHtml(label)}</td>` +
        `<td style="padding:2px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
    ),
    `</table>`,
    `<p style="margin-top:20px"><a href="${escapeHtml(reviewUrl)}" style="background:#047857;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open the review page</a></p>`,
    `<p style="color:#64748b;font-size:12px">${escapeHtml(CONFIDENTIALITY_FOOTER)}</p>`,
    `</div>`,
  ].join("");

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

/**
 * Note: `timeZoneName` cannot be combined with `dateStyle`/`timeStyle` — that
 * combination throws, and the fallback below would quietly put a raw ISO
 * timestamp in every notification. The fields are listed individually for that
 * reason.
 */
function formatEastern(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

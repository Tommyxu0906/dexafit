/**
 * Email configuration, read from the environment at send time.
 *
 * Nothing here throws. An unconfigured environment is a normal state — local
 * development and the test suite both run without an API key — so the caller
 * gets a reason back and logs it rather than taking a submission down with it.
 */

export type EmailConfig = {
  apiKey: string;
  from: string;
  adminRecipients: string[];
  supportEmail: string;
  appUrl: string;
};

export type EmailConfigResult =
  | { configured: true; config: EmailConfig }
  | { configured: false; reason: string };

/**
 * Resend's shared sending domain. It works without verifying a domain, but it
 * only delivers to the address that owns the Resend account. Set EMAIL_FROM to
 * an address on a verified DexaFit domain before notifying anyone else.
 */
const DEFAULT_FROM = "DexaFit Onboarding <onboarding@resend.dev>";
const DEFAULT_APP_URL = "http://localhost:3000";

function splitRecipients(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.includes("@"));
}

export type EmailEnv = Record<string, string | undefined>;

export function readEmailConfig(env: EmailEnv = process.env): EmailConfigResult {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      reason: "RESEND_API_KEY is not set, so no notification email was sent.",
    };
  }

  const adminRecipients = splitRecipients(env.ADMIN_NOTIFICATION_EMAILS);
  if (adminRecipients.length === 0) {
    return {
      configured: false,
      reason:
        "ADMIN_NOTIFICATION_EMAILS is not set to a valid address, so there was nobody to notify.",
    };
  }

  return {
    configured: true,
    config: {
      apiKey,
      from: env.EMAIL_FROM?.trim() || DEFAULT_FROM,
      adminRecipients,
      // Provider emails invite a reply. The sending address is a no-reply
      // identity nobody reads, so replies are pointed at a person: SUPPORT_EMAIL
      // if set, otherwise the first credentialing admin.
      supportEmail: env.SUPPORT_EMAIL?.trim() || adminRecipients[0],
      appUrl: (env.APP_URL || env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, ""),
    },
  };
}

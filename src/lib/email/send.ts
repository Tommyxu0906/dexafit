import { readEmailConfig, type EmailConfig, type EmailEnv } from "./config";

export type EmailMessage = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Lets a reviewer answer the applicant straight from the notification. */
  replyTo?: string;
};

export type SendResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

const SEND_TIMEOUT_MS = 10_000;

/**
 * Sends one email through Resend's HTTP API.
 *
 * This never throws and never rejects. Every caller is a side effect hanging off
 * a user action that has already succeeded — a provider's application is
 * submitted and stored whether or not the notification goes out — so a failure
 * here is reported to the caller and logged, not raised.
 */
export async function sendEmail(
  message: EmailMessage,
  env: EmailEnv = process.env,
): Promise<SendResult> {
  const configResult = readEmailConfig(env);
  if (!configResult.configured) {
    return { status: "skipped", reason: configResult.reason };
  }

  return sendWithConfig(message, configResult.config);
}

async function sendWithConfig(
  message: EmailMessage,
  config: EmailConfig,
): Promise<SendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        status: "failed",
        reason: `Resend returned ${response.status}: ${describeError(body)}`,
      };
    }

    const id =
      body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string"
        ? (body as { id: string }).id
        : "unknown";

    return { status: "sent", id };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function describeError(body: unknown): string {
  if (body && typeof body === "object") {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
    const name = (body as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "no error detail returned";
}

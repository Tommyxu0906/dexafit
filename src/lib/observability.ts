/**
 * Server-side error reporting.
 *
 * The dominant bug class in this codebase has been the silent one: a failed
 * database write or read that nobody noticed because the UI rendered a
 * plausible empty state on top of it. Logging alone did not help — the logs
 * were on a server nobody reads.
 *
 * Every unexpected server-side failure goes through `captureServerError`. It
 * returns a short event id that can be shown to the person who hit the error,
 * so a bug report ("it said evt_a1b2c3d4") leads straight to the entry.
 *
 * What may go into a report is deliberately constrained by the type below:
 * identifiers and an operation name, never row contents. Credential numbers,
 * document bytes, insurance policy numbers, compliance disclosure answers and
 * anything from the environment stay out, because a monitoring vendor is one
 * more place they could leak from.
 */

export type ErrorContext = {
  /** Dotted name of the failing operation, e.g. "admin.decideApplication". */
  operation: string;
  /** Identifiers only. Never row contents. */
  userId?: string;
  professionalId?: string;
  applicationId?: string;
  documentId?: string;
  /** A short, non-sensitive note, e.g. which table or which step. */
  detail?: string;
};

export type CapturedError = {
  eventId: string;
  message: string;
};

/**
 * Records an unexpected server-side failure and returns its event id.
 *
 * Never throws: a reporting problem must not become a second failure on top of
 * the one being reported.
 */
export function captureServerError(
  error: unknown,
  context: ErrorContext,
): CapturedError {
  const eventId = newEventId();
  const message = describe(error);

  const entry = {
    level: "error",
    eventId,
    ...context,
    message,
    timestamp: new Date().toISOString(),
  };

  // Structured, one line, so it is greppable by event id whatever is collecting
  // stdout. This happens whether or not a monitoring backend is configured.
  try {
    console.error(JSON.stringify(entry));
  } catch {
    console.error(`[${eventId}] ${context.operation}: ${message}`);
  }

  void forwardToSentry(entry, error);

  return { eventId, message };
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}

/** Short, random, and meaningless on its own — safe to show a user. */
function newEventId(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// Optional Sentry forwarding
// ---------------------------------------------------------------------------

/**
 * Posts one event to Sentry's envelope endpoint when SENTRY_DSN is set.
 *
 * Done with `fetch` against the documented endpoint rather than @sentry/nextjs:
 * the SDK wants an instrumentation file, a wrapped next.config and build-time
 * plugins, which is a large change to carry for a repository that may never
 * turn it on. The application runs identically with no DSN configured.
 */
async function forwardToSentry(
  entry: Record<string, unknown>,
  error: unknown,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    const parsed = parseDsn(dsn);
    if (!parsed) return;

    const event = {
      event_id: String(entry.eventId).replace("evt_", "").padEnd(32, "0"),
      timestamp: entry.timestamp,
      platform: "node",
      level: "error",
      environment: process.env.NODE_ENV ?? "development",
      transaction: entry.operation,
      message: { formatted: `${entry.operation}: ${entry.message}` },
      tags: { operation: entry.operation },
      extra: {
        userId: entry.userId,
        professionalId: entry.professionalId,
        applicationId: entry.applicationId,
        documentId: entry.documentId,
        detail: entry.detail,
      },
      exception:
        error instanceof Error
          ? {
              values: [
                {
                  type: error.name,
                  value: error.message,
                  stacktrace: undefined,
                },
              ],
            }
          : undefined,
    };

    const envelope =
      `${JSON.stringify({ event_id: event.event_id, dsn })}\n` +
      `${JSON.stringify({ type: "event" })}\n` +
      `${JSON.stringify(event)}\n`;

    await fetch(parsed.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`,
      },
      body: envelope,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // A monitoring outage is not worth a second error. The structured log line
    // above already happened.
  }
}

function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!projectId || !url.username) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

/**
 * Is this auth error just "nobody is signed in"?
 *
 * `getUser()` reports an anonymous visitor as an error — AuthSessionMissingError
 * — and an expired or malformed token with a 400/401. All of those are the
 * normal state of a public page, not incidents. Reporting them puts an entry on
 * every page load a logged-out visitor makes, which is the fastest way to make
 * a monitoring backend worthless.
 *
 * Anything else — a 500 from the auth service, a DNS failure, a timeout — is a
 * real fault and must still be reported.
 */
export function isSignedOutRatherThanBroken(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const name = (error as { name?: unknown }).name;
  if (name === "AuthSessionMissingError") return true;

  const status = (error as { status?: unknown }).status;
  return status === 400 || status === 401;
}

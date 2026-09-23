import { NextResponse } from "next/server";
import { EXPIRY_WARNING_DAYS } from "@/lib/domain/expiry";
import {
  notifyProviderOfExpiry,
  type ExpiringItemSummary,
} from "@/lib/email/provider-notifications";
import { captureServerError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DueWarning = {
  professional_id: string;
  recipient: string;
  provider_name: string;
  item_kind: ExpiringItemSummary["kind"];
  item_id: string;
  item_label: string;
  expiration_date: string;
};

/**
 * Daily: warn providers whose credentials or insurance lapse within 30 days.
 *
 * Ordering matters. It selects what is due, sends, and only then records what
 * went out. Recording first would lose a warning every time the mail provider
 * was down; this way the worst case is a duplicate tomorrow, which is the right
 * direction to fail in.
 *
 * Nothing here enforces anything. What happens when a credential actually
 * lapses — delisting, a grace period — has not been decided, and an expired
 * credential already blocks approval through the readiness engine.
 *
 * Authorization is a shared secret rather than the service_role key. The two
 * database functions this calls are the only elevated surface, and they check
 * the same secret themselves, so a caller who somehow reached this route
 * without it still gets nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.EXPIRY_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "EXPIRY_CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const presented = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (presented !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("due_expiry_warnings", {
    p_secret: secret,
    p_within_days: EXPIRY_WARNING_DAYS,
  });

  if (error) {
    const { eventId } = captureServerError(error, {
      operation: "cron.expiryWarnings.load",
    });
    return NextResponse.json(
      { error: "Could not load due warnings", eventId },
      { status: 500 },
    );
  }

  const due = (data ?? []) as DueWarning[];

  // One email per provider listing everything of theirs, rather than one email
  // per credential.
  const byProfessional = new Map<string, DueWarning[]>();
  for (const row of due) {
    const existing = byProfessional.get(row.professional_id);
    if (existing) existing.push(row);
    else byProfessional.set(row.professional_id, [row]);
  }

  const now = new Date();
  const sentCredentialIds: string[] = [];
  const sentPolicyIds: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const rows of byProfessional.values()) {
    const result = await notifyProviderOfExpiry(
      rows[0].recipient,
      {
        providerName: rows[0].provider_name,
        items: rows.map((r) => ({
          kind: r.item_kind,
          label: r.item_label,
          expirationDate: r.expiration_date,
        })),
      },
      now,
    );

    if (result.status === "sent") {
      sent += 1;
      // Only what actually went out is marked, so a failure is retried
      // tomorrow rather than silently dropped.
      for (const row of rows) {
        if (row.item_kind === "CREDENTIAL") sentCredentialIds.push(row.item_id);
        else sentPolicyIds.push(row.item_id);
      }
    } else if (result.status === "failed") {
      failed += 1;
      captureServerError(result.reason, {
        operation: "cron.expiryWarnings.send",
        professionalId: rows[0].professional_id,
      });
    }
  }

  let marked = 0;
  if (sentCredentialIds.length > 0 || sentPolicyIds.length > 0) {
    const { data: markedCount, error: markError } = await supabase.rpc(
      "mark_expiry_warnings_sent",
      {
        p_secret: secret,
        p_credential_ids: sentCredentialIds,
        p_policy_ids: sentPolicyIds,
      },
    );

    if (markError) {
      // The provider has been warned; failing to record it means they hear
      // again tomorrow. Worth knowing about, not worth failing the run.
      captureServerError(markError, { operation: "cron.expiryWarnings.mark" });
    } else {
      marked = Number(markedCount ?? 0);
    }
  }

  return NextResponse.json({
    windowDays: EXPIRY_WARNING_DAYS,
    due: due.length,
    providers: byProfessional.size,
    sent,
    failed,
    marked,
  });
}

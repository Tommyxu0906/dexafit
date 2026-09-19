import { NextResponse } from "next/server";
import { resolveAppUrl } from "@/lib/env";
import { readEmailConfig } from "@/lib/email/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Liveness and configuration check for whatever is watching the deployment.
 *
 * Unauthenticated, so it reports only booleans and a status word: whether the
 * database answered, and whether each piece of configuration is present. It
 * never returns a URL, a key, a database error message or a row — knowing that
 * something is misconfigured is enough for a monitor, and anything more would
 * be a free reconnaissance endpoint.
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    appUrlConfigured: resolveAppUrl().ok,
    emailConfigured: readEmailConfig().configured,
    database: false,
  };

  try {
    const supabase = await createClient();
    // Cheapest possible round trip: reference data, head request, no rows
    // returned. RLS still applies, and an anonymous caller reads nothing.
    const { error } = await supabase
      .from("capabilities")
      .select("code", { head: true, count: "exact" })
      .limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  // The database answering is what makes this deployment usable at all;
  // configuration gaps degrade features without taking the site down.
  const status = !checks.database
    ? "down"
    : Object.values(checks).every(Boolean)
      ? "ok"
      : "degraded";

  return NextResponse.json(
    { status, checks, time: new Date().toISOString() },
    { status: status === "down" ? 503 : 200 },
  );
}

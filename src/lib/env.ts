/**
 * Environment the application cannot run without, checked where the failure is
 * still legible.
 *
 * Reading these with `process.env.X!` pushes the failure into the Supabase
 * client, where a missing URL surfaces as a parse error several frames deep and
 * a missing key as a 401 that looks like an auth bug. Naming the variable at
 * the point of use turns a deployment mistake into a one-line answer.
 */

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

export function readPublicSupabaseEnv(
  env: Record<string, string | undefined> = process.env,
): PublicSupabaseEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment ${missing.length > 1 ? "variables" : "variable"}: ${missing.join(", ")}. Set ${missing.length > 1 ? "them" : "it"} in .env.local for local development, or in the hosting provider's environment settings.`,
    );
  }

  return { url: url as string, anonKey: anonKey as string };
}

export type AppUrlResult =
  | { ok: true; appUrl: string }
  | { ok: false; reason: string };

/**
 * The base URL that links in outbound email point at.
 *
 * In production this must be configured. Falling back to localhost there would
 * send every provider a status link to a machine that is not theirs, so the
 * notification is refused with a reason instead — a visible, explained gap
 * rather than mail that looks fine and cannot be clicked.
 */
export function resolveAppUrl(
  env: Record<string, string | undefined> = process.env,
): AppUrlResult {
  const configured = (env.APP_URL || env.NEXT_PUBLIC_APP_URL)?.trim();

  if (!configured) {
    if (env.NODE_ENV === "production") {
      return {
        ok: false,
        reason:
          "APP_URL is not set, so email links would point at localhost. Set it to the production URL, e.g. https://app.dexafit.com.",
      };
    }
    return { ok: true, appUrl: "http://localhost:3000" };
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    return {
      ok: false,
      reason: `APP_URL is not a valid URL: "${configured}". Use a full origin, e.g. https://app.dexafit.com.`,
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      reason: `APP_URL must be an http(s) URL, not "${parsed.protocol}".`,
    };
  }

  if (env.NODE_ENV === "production" && parsed.hostname === "localhost") {
    return {
      ok: false,
      reason:
        "APP_URL points at localhost in production, so email links would be unusable. Set it to the public URL.",
    };
  }

  return { ok: true, appUrl: configured.replace(/\/+$/, "") };
}

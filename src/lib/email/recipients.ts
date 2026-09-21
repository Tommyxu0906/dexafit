import { createClient } from "../supabase/server";

export type RecipientResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

/**
 * The address a provider may be told about their own application.
 *
 * `professional_profiles.email` is typed into step 1 of the wizard and is never
 * verified — a provider can put their assistant's address there, or a typo, or
 * a stranger's. Sending application status to it would disclose someone's
 * review progress to whoever happens to own that mailbox.
 *
 * This resolves the confirmed Supabase Auth address instead: the address that
 * received the magic link, which is what proves control of the account. The
 * `verified_auth_email` function enforces both the confirmation requirement and
 * who is allowed to ask (the provider themselves, or an admin).
 *
 * Resolve this *before* handing work to `after()` so the lookup runs while the
 * request's auth cookies are unambiguously in scope, then pass the address into
 * the callback.
 */
export async function resolveVerifiedProviderEmail(
  professionalId: string,
): Promise<RecipientResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verified_auth_email", {
    p_professional_id: professionalId,
  });

  if (error) {
    return { ok: false, reason: `Could not resolve the recipient: ${error.message}` };
  }
  if (typeof data !== "string" || data.length === 0) {
    // Either the address was never confirmed, or the caller is not entitled to
    // it. Both mean the same thing here: there is no address we may write to.
    return {
      ok: false,
      reason: "No confirmed account address is available for this professional.",
    };
  }

  return { ok: true, email: data };
}

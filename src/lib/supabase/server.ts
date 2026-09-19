import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicSupabaseEnv } from "../env";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseEnv = readPublicSupabaseEnv();

  return createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component; safe to ignore
            // when middleware is refreshing sessions.
          }
        },
      },
    },
  );
}

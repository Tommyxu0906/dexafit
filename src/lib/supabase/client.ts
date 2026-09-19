import { createBrowserClient } from "@supabase/ssr";
import { readPublicSupabaseEnv } from "../env";

export function createClient() {
  const supabaseEnv = readPublicSupabaseEnv();

  return createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
  );
}

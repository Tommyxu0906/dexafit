import { createBrowserClient } from "@supabase/ssr";
import { readPublicSupabaseEnv } from "../env";

export function createClient() {
  // The two values are written out in full rather than read off `process.env`,
  // because the bundler substitutes the literal expression
  // `process.env.NEXT_PUBLIC_*` at build time and nothing else. Passing
  // `process.env` itself into a function defeats that: in the browser it
  // resolves to Next's process polyfill, whose `env` is an empty object, and
  // every call would throw "Missing required environment variable" on a
  // correctly configured deployment.
  const { url, anonKey } = readPublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createBrowserClient(url, anonKey);
}

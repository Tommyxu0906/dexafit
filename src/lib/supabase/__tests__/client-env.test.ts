import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The browser bundle only receives an environment value if the bundler sees the
 * literal expression `process.env.NEXT_PUBLIC_*`. Passing `process.env` itself
 * into a helper defeats that: in the browser it resolves to Next's process
 * polyfill, whose `env` is an empty object, so the helper throws "Missing
 * required environment variable" on a correctly configured deployment and the
 * login page is dead.
 *
 * This is a source-level check because the failure exists only in the bundled
 * client output, which the unit tests never see — and it is here because that
 * bug has already been written into this file once.
 */
describe("the browser Supabase client", () => {
  const source = readFileSync(new URL("../client.ts", import.meta.url), "utf8");

  it("names each NEXT_PUBLIC variable in full so the bundler inlines it", () => {
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("does not reach the environment through a bare process.env", () => {
    expect(source).not.toMatch(/readPublicSupabaseEnv\(\s*\)/);
    expect(source).not.toMatch(/readPublicSupabaseEnv\(\s*process\.env\s*\)/);
  });
});

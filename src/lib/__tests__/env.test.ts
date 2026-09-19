import { describe, expect, it } from "vitest";
import { readPublicSupabaseEnv, resolveAppUrl } from "../env";

describe("readPublicSupabaseEnv", () => {
  it("names the variable that is missing", () => {
    expect(() => readPublicSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expect(() => readPublicSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "u" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("names both when both are missing", () => {
    expect(() => readPublicSupabaseEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("treats an empty string as missing", () => {
    expect(() =>
      readPublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "   ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns both values when configured", () => {
    expect(
      readPublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).toEqual({ url: "https://x.supabase.co", anonKey: "anon" });
  });
});

describe("resolveAppUrl", () => {
  it("falls back to localhost in development", () => {
    const result = resolveAppUrl({ NODE_ENV: "development" });
    expect(result).toEqual({ ok: true, appUrl: "http://localhost:3000" });
  });

  it("refuses to fall back to localhost in production", () => {
    // Otherwise every provider gets a status link to a machine that is not
    // theirs, and the email looks perfectly fine on the way out.
    const result = resolveAppUrl({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/APP_URL/);
  });

  it("rejects an APP_URL left pointing at localhost in production", () => {
    const result = resolveAppUrl({
      NODE_ENV: "production",
      APP_URL: "http://localhost:3000",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a value that is not a URL", () => {
    const result = resolveAppUrl({ APP_URL: "app.dexafit.com" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/valid URL/);
  });

  it("rejects a non-http scheme", () => {
    const result = resolveAppUrl({ APP_URL: "ftp://app.dexafit.com" });
    expect(result.ok).toBe(false);
  });

  it("strips a trailing slash so links never come out doubled", () => {
    expect(resolveAppUrl({ APP_URL: "https://app.dexafit.com/" })).toEqual({
      ok: true,
      appUrl: "https://app.dexafit.com",
    });
  });

  it("accepts NEXT_PUBLIC_APP_URL as an alternative", () => {
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://app.dexafit.com" })).toEqual({
      ok: true,
      appUrl: "https://app.dexafit.com",
    });
  });
});

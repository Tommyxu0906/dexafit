import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "../cron-auth";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("authorizeCronRequest", () => {
  it("reads the variable name Vercel actually injects", () => {
    // Vercel attaches the Authorization header only when the project variable
    // is named exactly CRON_SECRET. Reading any other name produces a job that
    // 401s every day while looking, in the logs, like the guard working.
    expect(
      authorizeCronRequest(`Bearer ${SECRET}`, { CRON_SECRET: SECRET }),
    ).toEqual({ ok: true, secret: SECRET });
  });

  it("still accepts the older name for running the job by hand", () => {
    expect(
      authorizeCronRequest(`Bearer ${SECRET}`, { EXPIRY_CRON_SECRET: SECRET }),
    ).toEqual({ ok: true, secret: SECRET });
  });

  it("prefers CRON_SECRET when both are set", () => {
    const result = authorizeCronRequest(`Bearer ${SECRET}`, {
      CRON_SECRET: SECRET,
      EXPIRY_CRON_SECRET: "stale-value",
    });
    expect(result).toEqual({ ok: true, secret: SECRET });
  });

  it("refuses to run at all rather than run unauthenticated", () => {
    const result = authorizeCronRequest(`Bearer ${SECRET}`, {});
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: "CRON_SECRET is not configured",
    });
  });

  it("does not let an empty or blank secret authorize anything", () => {
    // An unset variable in a dashboard is easy to create as "" rather than absent.
    expect(authorizeCronRequest("Bearer ", { CRON_SECRET: "" }).ok).toBe(false);
    expect(authorizeCronRequest("Bearer    ", { CRON_SECRET: "   " }).ok).toBe(false);
  });

  it("rejects a missing, bare or wrong header", () => {
    for (const header of [
      null,
      undefined,
      "",
      SECRET, // no scheme
      `Basic ${SECRET}`,
      "Bearer wrong",
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(0, -1)}`,
    ]) {
      const result = authorizeCronRequest(header, { CRON_SECRET: SECRET });
      expect(result, `accepted ${JSON.stringify(header)}`).toEqual({
        ok: false,
        status: 401,
        error: "Unauthorized",
      });
    }
  });

  it("tells a missing secret apart from a wrong one", () => {
    // 503 means "nobody configured this"; 401 means "you are not allowed".
    // Collapsing them would hide a deployment mistake behind a security error.
    const unconfigured = authorizeCronRequest(null, {});
    const wrong = authorizeCronRequest(null, { CRON_SECRET: SECRET });
    expect(unconfigured.ok === false && unconfigured.status).toBe(503);
    expect(wrong.ok === false && wrong.status).toBe(401);
  });

  it("tolerates the scheme's casing and surrounding whitespace", () => {
    expect(authorizeCronRequest(`  bearer ${SECRET}  `, { CRON_SECRET: SECRET }).ok).toBe(
      true,
    );
  });
});

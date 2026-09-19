import { afterEach, describe, expect, it, vi } from "vitest";
import { captureServerError, isSignedOutRatherThanBroken } from "../observability";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function captureLogLine(): () => string {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => String(spy.mock.calls.at(-1)?.[0] ?? "");
}

describe("captureServerError", () => {
  it("returns an id that can be shown to whoever hit the error", () => {
    captureLogLine();
    const { eventId } = captureServerError(new Error("boom"), {
      operation: "admin.decideApplication",
    });

    expect(eventId).toMatch(/^evt_[0-9a-f]{10}$/);
  });

  it("gives each failure its own id", () => {
    captureLogLine();
    const first = captureServerError("a", { operation: "x" }).eventId;
    const second = captureServerError("b", { operation: "x" }).eventId;

    expect(first).not.toBe(second);
  });

  it("logs one structured line carrying the operation and the identifiers", () => {
    const lastLine = captureLogLine();
    const { eventId } = captureServerError(new Error("row not found"), {
      operation: "admin.decideApplication.lookup",
      userId: "user-1",
      applicationId: "app-1",
      detail: "professional_applications",
    });

    const entry = JSON.parse(lastLine());
    expect(entry).toMatchObject({
      level: "error",
      eventId,
      operation: "admin.decideApplication.lookup",
      userId: "user-1",
      applicationId: "app-1",
      detail: "professional_applications",
      message: "row not found",
    });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("reports an error that is not an Error, and never throws on odd input", () => {
    captureLogLine();

    expect(() => captureServerError(null, { operation: "x" })).not.toThrow();
    expect(() => captureServerError(undefined, { operation: "x" })).not.toThrow();
    expect(captureServerError({ message: "pg error" }, { operation: "x" }).message).toBe(
      "pg error",
    );
    expect(captureServerError(42, { operation: "x" }).message).toBe("Unknown error");
  });

  it("survives a value that cannot be serialised", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const circular: Record<string, unknown> = { message: "loop" };
    circular.self = circular;

    expect(() => captureServerError(circular, { operation: "x" })).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });

  it("does not reach the network when no DSN is configured", async () => {
    captureLogLine();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    captureServerError(new Error("boom"), { operation: "x" });
    await vi.waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
  });

  it("forwards to Sentry's envelope endpoint when a DSN is configured", async () => {
    captureLogLine();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubEnv("SENTRY_DSN", "https://publickey@o123.ingest.sentry.io/456");

    captureServerError(new Error("boom"), {
      operation: "admin.decideApplication",
      userId: "user-1",
    });

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://o123.ingest.sentry.io/api/456/envelope/");
    expect((init.headers as Record<string, string>)["X-Sentry-Auth"]).toContain(
      "sentry_key=publickey",
    );
    expect(String(init.body)).toContain("admin.decideApplication");
  });

  it("keeps working when the monitoring backend is down or the DSN is junk", async () => {
    const lastLine = captureLogLine();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sentry unreachable"));

    vi.stubEnv("SENTRY_DSN", "not a url");
    expect(() => captureServerError(new Error("boom"), { operation: "x" })).not.toThrow();

    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/2");
    expect(() => captureServerError(new Error("boom"), { operation: "x" })).not.toThrow();

    // The local record is what the guarantee rests on, so it must survive.
    expect(JSON.parse(lastLine()).message).toBe("boom");
  });

  it("puts nothing in a report beyond identifiers and the operation", () => {
    const lastLine = captureLogLine();
    captureServerError(new Error("update failed"), {
      operation: "admin.reviewCredential",
      userId: "user-1",
      professionalId: "prof-1",
      applicationId: "app-1",
      documentId: "doc-1",
      detail: "credentials",
    });

    // The context type admits only these keys; this holds the serialised shape
    // to them, so a row object cannot be spread in later without failing here.
    expect(Object.keys(JSON.parse(lastLine())).sort()).toEqual([
      "applicationId",
      "detail",
      "documentId",
      "eventId",
      "level",
      "message",
      "operation",
      "professionalId",
      "timestamp",
      "userId",
    ]);
  });
});

describe("isSignedOutRatherThanBroken", () => {
  it("treats an anonymous visitor as normal, not as an incident", () => {
    // getUser() reports "no session" as an error. Reporting it would put an
    // entry on every page load a logged-out visitor makes.
    expect(
      isSignedOutRatherThanBroken(
        Object.assign(new Error("Auth session missing!"), {
          name: "AuthSessionMissingError",
          status: 400,
        }),
      ),
    ).toBe(true);
  });

  it("treats an expired or malformed token as normal", () => {
    expect(isSignedOutRatherThanBroken({ status: 401 })).toBe(true);
    expect(isSignedOutRatherThanBroken({ status: 400 })).toBe(true);
  });

  it("still reports a genuine auth service fault", () => {
    expect(isSignedOutRatherThanBroken({ status: 500 })).toBe(false);
    expect(isSignedOutRatherThanBroken({ status: 503 })).toBe(false);
    expect(isSignedOutRatherThanBroken(new Error("fetch failed"))).toBe(false);
    expect(isSignedOutRatherThanBroken(null)).toBe(false);
  });
});

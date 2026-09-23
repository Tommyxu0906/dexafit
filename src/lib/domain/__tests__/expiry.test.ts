import { describe, expect, it } from "vitest";
import {
  EXPIRY_WARNING_DAYS,
  daysUntilExpiry,
  describeTimeToExpiry,
  hasExpired,
  needsExpiryWarning,
} from "../expiry";

// Mid-morning, so a naive date subtraction that ignores the time of day shows up.
const NOW = new Date("2026-09-23T10:00:00Z");

describe("daysUntilExpiry", () => {
  it("counts a credential valid through the end of its expiration date", () => {
    // Expiring today still has the rest of today.
    expect(daysUntilExpiry("2026-09-23", NOW)).toBe(0);
    expect(daysUntilExpiry("2026-09-24", NOW)).toBe(1);
    expect(daysUntilExpiry("2026-10-23", NOW)).toBe(30);
  });

  it("goes negative once past", () => {
    expect(daysUntilExpiry("2026-09-22", NOW)).toBeLessThan(0);
  });
});

describe("hasExpired", () => {
  it("does not call something expired on the day it expires", () => {
    expect(hasExpired("2026-09-23", NOW)).toBe(false);
    expect(hasExpired("2026-09-22", NOW)).toBe(true);
  });
});

describe("needsExpiryWarning", () => {
  it("warns inside the window", () => {
    expect(needsExpiryWarning("2026-10-01", NOW)).toBe(true);
    expect(needsExpiryWarning("2026-10-23", NOW)).toBe(true);
  });

  it("stays quiet outside it", () => {
    expect(needsExpiryWarning("2026-10-24", NOW)).toBe(false);
    expect(needsExpiryWarning("2027-05-01", NOW)).toBe(false);
  });

  it("does not warn about something already expired", () => {
    // That is the enforcement question nobody has answered; a "renew soon"
    // email about a credential that lapsed last month is the wrong message.
    expect(needsExpiryWarning("2026-09-22", NOW)).toBe(false);
    expect(needsExpiryWarning("2025-01-01", NOW)).toBe(false);
  });

  it("treats a missing or unparseable date as nothing to say", () => {
    expect(needsExpiryWarning(null, NOW)).toBe(false);
    expect(needsExpiryWarning(undefined, NOW)).toBe(false);
    expect(needsExpiryWarning("", NOW)).toBe(false);
    expect(needsExpiryWarning("not-a-date", NOW)).toBe(false);
  });

  it("uses a thirty-day window by default", () => {
    expect(EXPIRY_WARNING_DAYS).toBe(30);
    const lastDayInside = "2026-10-23";
    const firstDayOutside = "2026-10-24";
    expect(needsExpiryWarning(lastDayInside, NOW)).toBe(true);
    expect(needsExpiryWarning(firstDayOutside, NOW)).toBe(false);
  });

  it("can be asked about a different window", () => {
    expect(needsExpiryWarning("2026-10-01", NOW, 7)).toBe(false);
    expect(needsExpiryWarning("2026-09-28", NOW, 7)).toBe(true);
  });
});

describe("describeTimeToExpiry", () => {
  it("reads naturally at the edges", () => {
    expect(describeTimeToExpiry("2026-09-23", NOW)).toBe("today");
    expect(describeTimeToExpiry("2026-09-24", NOW)).toBe("tomorrow");
    expect(describeTimeToExpiry("2026-10-05", NOW)).toBe("in 12 days");
  });
});

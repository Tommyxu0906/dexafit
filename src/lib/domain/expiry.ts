/**
 * When a credential or policy is close enough to lapsing to warn about it.
 *
 * Only the warning is decided. What happens on the day something actually
 * expires — immediate delisting, a grace period, advance suspension — is an
 * open product and legal question, so nothing here enforces anything. An
 * expired credential already blocks submission and approval through the
 * readiness engine; this only gives the provider notice beforehand.
 */

export const EXPIRY_WARNING_DAYS = 30;

export type ExpiringItemKind = "CREDENTIAL" | "INSURANCE";

export type ExpiringItem = {
  kind: ExpiringItemKind;
  id: string;
  /** What the provider calls it, e.g. "Massachusetts Physical Therapist license". */
  label: string;
  /** ISO date, YYYY-MM-DD. */
  expirationDate: string;
};

/**
 * A dated credential is valid through the end of its expiration date, which is
 * how `isExpired` in the onboarding actions and the readiness engine both read
 * it. Anything here has to agree with them, or a provider is warned about
 * something the rest of the system still considers current.
 */
function endOfDay(date: string): number {
  return new Date(`${date}T23:59:59Z`).getTime();
}

export function isValidDate(date: string | null | undefined): date is string {
  if (!date) return false;
  return !Number.isNaN(endOfDay(date));
}

/** Whole days from `now` until the end of the expiration date. Negative once past. */
export function daysUntilExpiry(date: string, now: Date): number {
  return Math.floor((endOfDay(date) - now.getTime()) / 86_400_000);
}

export function hasExpired(date: string, now: Date): boolean {
  return endOfDay(date) < now.getTime();
}

/**
 * Warn only in the window before it lapses.
 *
 * Something already expired is deliberately excluded: that is the enforcement
 * question nobody has answered yet, and a "renew soon" email about a credential
 * that lapsed last month would be both wrong and the wrong message.
 */
export function needsExpiryWarning(
  date: string | null | undefined,
  now: Date,
  withinDays: number = EXPIRY_WARNING_DAYS,
): boolean {
  if (!isValidDate(date)) return false;
  if (hasExpired(date, now)) return false;
  return daysUntilExpiry(date, now) <= withinDays;
}

/** "in 12 days", "tomorrow", "today" — the subject line needs to land. */
export function describeTimeToExpiry(date: string, now: Date): string {
  const days = daysUntilExpiry(date, now);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

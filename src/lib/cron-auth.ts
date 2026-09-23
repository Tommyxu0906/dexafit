/**
 * Authorizing a scheduled request.
 *
 * The variable name is load-bearing. Vercel only attaches an `Authorization`
 * header to a cron invocation when the project has an environment variable
 * named exactly `CRON_SECRET` — any other name and the request arrives bare.
 * Reading a differently-named variable here would have produced a job that
 * returned 401 every single day: Vercel does not retry a failed invocation, and
 * a 401 in the log reads as the guard doing its job rather than as a
 * misconfiguration, so nothing would ever have looked wrong.
 *
 * `EXPIRY_CRON_SECRET` stays accepted as a fallback for running the job by hand
 * against a local or preview deployment, where nothing is injecting anything.
 */

export type CronAuthResult =
  | { ok: true; secret: string }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Length-independent comparison. A remote timing attack against an HTTPS
 * endpoint is not realistic, but the whole point of this secret is that it is
 * the only thing standing in front of an elevated database function, and a
 * constant-time compare costs nothing.
 */
function secretsMatch(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < presented.length; i += 1) {
    difference |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

export function authorizeCronRequest(
  authorizationHeader: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): CronAuthResult {
  const secret = env.CRON_SECRET?.trim() || env.EXPIRY_CRON_SECRET?.trim();

  if (!secret) {
    // Refusing to run beats running unauthenticated.
    return {
      ok: false,
      status: 503,
      error: "CRON_SECRET is not configured",
    };
  }

  const presented = authorizationHeader?.trim();
  if (!presented || !/^Bearer /i.test(presented)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!secretsMatch(presented.slice("Bearer ".length).trim(), secret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, secret };
}

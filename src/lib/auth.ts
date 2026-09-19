import { redirect } from "next/navigation";
import { captureServerError } from "./observability";
import { createClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  role: "PROFESSIONAL" | "ADMIN";
};

/**
 * Identity always comes from the auth cookie, never from a client-submitted id.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // An auth service outage is not the same as a signed-out visitor. Returning
  // null for both sends a signed-in user round the login loop with no idea why
  // their magic link keeps "not working".
  if (authError && authError.status !== 401) {
    const { eventId } = captureServerError(authError, { operation: "auth.getUser" });
    throw new Error(
      `We could not verify your session just now. Please try again — reference ${eventId}.`,
    );
  }
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    const { eventId } = captureServerError(error, {
      operation: "auth.loadAppUser",
      userId: user.id,
    });
    throw new Error(
      `We could not load your account just now. Please try again — reference ${eventId}.`,
    );
  }

  if (!data) return null;
  return data as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

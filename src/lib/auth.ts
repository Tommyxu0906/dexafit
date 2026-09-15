import { redirect } from "next/navigation";
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
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

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

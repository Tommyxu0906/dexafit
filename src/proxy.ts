import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicSupabaseEnv } from "./lib/env";
import {
  captureServerError,
  isSignedOutRatherThanBroken,
} from "./lib/observability";

const PROTECTED_PREFIXES = ["/professionals/onboarding", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseEnv = readPublicSupabaseEnv();
  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie; do not remove.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Failing closed is right on a protected route, but it looks identical to a
  // signed-out visitor. Record it so a wave of "my link stopped working" has
  // something behind it.
  if (authError && !isSignedOutRatherThanBroken(authError)) {
    captureServerError(authError, {
      operation: "proxy.getUser",
      detail: request.nextUrl.pathname,
    });
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

import { auth } from "@clerk/nextjs/server";
import { generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleClient, GOOGLE_SCOPES } from "@/lib/oauth/google";
import {
  generateState,
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/oauth/state";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(
      new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = getGoogleClient().createAuthorizationURL(
    state,
    codeVerifier,
    GOOGLE_SCOPES
  );
  // Force refresh-token issuance + always show the consent screen
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  const jar = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 min
  };
  jar.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  jar.set(OAUTH_PKCE_COOKIE, codeVerifier, cookieOptions);

  return NextResponse.redirect(url);
}

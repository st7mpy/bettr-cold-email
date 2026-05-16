import { auth } from "@clerk/nextjs/server";
import { generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMicrosoftClient, MICROSOFT_SCOPES } from "@/lib/oauth/microsoft";
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
  const url = getMicrosoftClient().createAuthorizationURL(
    state,
    codeVerifier,
    MICROSOFT_SCOPES
  );

  const jar = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  jar.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  jar.set(OAUTH_PKCE_COOKIE, codeVerifier, cookieOptions);

  return NextResponse.redirect(url);
}

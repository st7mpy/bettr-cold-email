import { auth } from "@clerk/nextjs/server";
import { OAuth2RequestError } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { getMicrosoftClient } from "@/lib/oauth/microsoft";
import {
  OAUTH_PKCE_COOKIE,
  OAUTH_STATE_COOKIE,
  verifyState,
} from "@/lib/oauth/state";
import { encryptToken } from "@/lib/crypto/encrypt";

function settingsRedirect(query: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/settings?${query}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(
      new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const jar = await cookies();
  const cookieState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = jar.get(OAUTH_PKCE_COOKIE)?.value;

  jar.delete(OAUTH_STATE_COOKIE);
  jar.delete(OAUTH_PKCE_COOKIE);

  if (errorParam) {
    return settingsRedirect(`error=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state || !codeVerifier) {
    return settingsRedirect("error=missing_params");
  }
  if (!verifyState(cookieState, state)) {
    return settingsRedirect("error=invalid_state");
  }

  let accessToken: string;
  let refreshToken: string;
  let accessTokenExpiresAt: Date;
  let email: string;

  try {
    const tokens = await getMicrosoftClient().validateAuthorizationCode(
      code,
      codeVerifier
    );
    accessToken = tokens.accessToken();
    refreshToken = tokens.refreshToken();
    accessTokenExpiresAt = tokens.accessTokenExpiresAt();

    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) return settingsRedirect("error=profile_failed");
    const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
    email = me.mail ?? me.userPrincipalName ?? "";
    if (!email) return settingsRedirect("error=no_email");
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      return settingsRedirect(
        `error=${encodeURIComponent(e.code ?? "exchange_failed")}`
      );
    }
    throw e;
  }

  await db.insert(emailAccounts).values({
    userId,
    provider: "outlook",
    oauthAccessToken: await encryptToken(accessToken),
    oauthRefreshToken: await encryptToken(refreshToken),
    oauthExpiresAt: accessTokenExpiresAt,
    status: "active",
  });

  return settingsRedirect(`connected=${encodeURIComponent(email)}`);
}

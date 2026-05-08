import { auth } from "@clerk/nextjs/server";
import { OAuth2RequestError } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getGoogleClient } from "@/lib/oauth/google";
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

  // Always clear cookies — single-use
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

  try {
    const tokens = await getGoogleClient().validateAuthorizationCode(
      code,
      codeVerifier
    );
    accessToken = tokens.accessToken();
    refreshToken = tokens.refreshToken();
    accessTokenExpiresAt = tokens.accessTokenExpiresAt();
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      return settingsRedirect(
        `error=${encodeURIComponent(e.code ?? "exchange_failed")}`
      );
    }
    throw e;
  }

  // Identify which Google account they connected
  const userInfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!userInfoRes.ok) {
    return settingsRedirect("error=userinfo_failed");
  }
  const { email } = (await userInfoRes.json()) as { email?: string };
  if (!email) return settingsRedirect("error=no_email");

  // Mark any existing active account for this user as revoked first,
  // then insert the new one. (Partial unique index allows only one active.)
  await db.transaction(async (tx) => {
    await tx
      .update(emailAccounts)
      .set({ status: "revoked" })
      .where(
        and(
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.status, "active")
        )
      );
    await tx.insert(emailAccounts).values({
      userId,
      provider: "gmail",
      oauthAccessToken: await encryptToken(accessToken),
      oauthRefreshToken: await encryptToken(refreshToken),
      oauthExpiresAt: accessTokenExpiresAt,
      status: "active",
    });
  });

  return settingsRedirect(`connected=${encodeURIComponent(email)}`);
}

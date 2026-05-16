import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/lib/crypto/encrypt";
import { getGoogleClient } from "@/lib/oauth/google";
import { getMicrosoftClient, MICROSOFT_SCOPES } from "@/lib/oauth/microsoft";

const REFRESH_SKEW_MS = 60_000;

export async function getAccessTokenForAccount(
  accountId: string
): Promise<string> {
  const [row] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId));
  if (!row) throw new Error(`email account ${accountId} not found`);
  if (row.status !== "active") {
    throw new Error(
      `email account ${accountId} is not active (status=${row.status})`
    );
  }

  const expiresAt = row.oauthExpiresAt.getTime();
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return decryptToken(row.oauthAccessToken);
  }

  const originalCipher = row.oauthAccessToken;
  const refreshToken = await decryptToken(row.oauthRefreshToken);

  let newAccess: string;
  let newExpiresAt: Date;
  let nextRefreshEncrypted = row.oauthRefreshToken;

  if (row.provider === "outlook") {
    const tokens = await getMicrosoftClient().refreshAccessToken(refreshToken, MICROSOFT_SCOPES);
    newAccess = tokens.accessToken();
    newExpiresAt = tokens.accessTokenExpiresAt();
    try {
      const maybeNewRefresh = tokens.refreshToken();
      if (maybeNewRefresh && maybeNewRefresh !== refreshToken) {
        nextRefreshEncrypted = await encryptToken(maybeNewRefresh);
      }
    } catch {
      // Microsoft may not rotate refresh token
    }
  } else {
    const tokens = await getGoogleClient().refreshAccessToken(refreshToken);
    newAccess = tokens.accessToken();
    newExpiresAt = tokens.accessTokenExpiresAt();
    try {
      const maybeNewRefresh = tokens.refreshToken();
      if (maybeNewRefresh && maybeNewRefresh !== refreshToken) {
        nextRefreshEncrypted = await encryptToken(maybeNewRefresh);
      }
    } catch {
      // Google may not rotate refresh token
    }
  }

  // Optimistic lock: only persist if no concurrent refresh beat us
  const updated = await db
    .update(emailAccounts)
    .set({
      oauthAccessToken: await encryptToken(newAccess),
      oauthRefreshToken: nextRefreshEncrypted,
      oauthExpiresAt: newExpiresAt,
    })
    .where(
      and(
        eq(emailAccounts.id, accountId),
        eq(emailAccounts.oauthAccessToken, originalCipher)
      )
    )
    .returning({ id: emailAccounts.id });

  if (updated.length === 0) {
    const [reread] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    return decryptToken(reread.oauthAccessToken);
  }

  return newAccess;
}

import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/lib/crypto/encrypt";
import { getGoogleClient } from "@/lib/oauth/google";

const REFRESH_SKEW_MS = 60_000; // refresh if expires within 60s

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

  const refreshToken = await decryptToken(row.oauthRefreshToken);
  const tokens = await getGoogleClient().refreshAccessToken(refreshToken);
  const newAccess = tokens.accessToken();
  const newExpiresAt = tokens.accessTokenExpiresAt();

  // Google sometimes rotates the refresh token; if so, persist the new one
  let nextRefreshEncrypted = row.oauthRefreshToken;
  try {
    const maybeNewRefresh = tokens.refreshToken();
    if (maybeNewRefresh && maybeNewRefresh !== refreshToken) {
      nextRefreshEncrypted = await encryptToken(maybeNewRefresh);
    }
  } catch {
    // refreshToken() throws if not present — leave stored value alone
  }

  await db
    .update(emailAccounts)
    .set({
      oauthAccessToken: await encryptToken(newAccess),
      oauthRefreshToken: nextRefreshEncrypted,
      oauthExpiresAt: newExpiresAt,
    })
    .where(eq(emailAccounts.id, accountId));

  return newAccess;
}

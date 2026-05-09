import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
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

  const originalCipher = row.oauthAccessToken;

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

  // Optimistic lock: only persist our newly-refreshed token if no other
  // process beat us to it. WHERE oauthAccessToken = <original ciphertext>
  // ensures we lose the race silently when a concurrent refresh has already
  // written a fresher token. In that case we re-read and return the winner's
  // value rather than racing past it with a stale reissue.
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
    // Lost the race — another process refreshed first. Re-read and return
    // whatever is canonical now.
    const [reread] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    return decryptToken(reread.oauthAccessToken);
  }

  return newAccess;
}

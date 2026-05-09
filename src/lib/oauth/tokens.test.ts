import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { db } from "@/db";
import { emailAccounts, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "@/lib/crypto/encrypt";

const mockRefreshAccessToken = vi.fn();

vi.mock("@/lib/oauth/google", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getGoogleClient: () => ({
      refreshAccessToken: mockRefreshAccessToken,
    }),
  };
});

beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
  }
});

const { getAccessTokenForAccount } = await import("./tokens");

const TEST_USER_ID = "user_test_tokens_phase2";

async function seed(opts: { expiresInSeconds: number }) {
  await db
    .insert(users)
    .values({ id: TEST_USER_ID, email: "tokens-test@example.com" })
    .onConflictDoNothing();

  await db.delete(emailAccounts).where(eq(emailAccounts.userId, TEST_USER_ID));

  const [row] = await db
    .insert(emailAccounts)
    .values({
      userId: TEST_USER_ID,
      provider: "gmail",
      oauthAccessToken: await encryptToken("OLD-ACCESS"),
      oauthRefreshToken: await encryptToken("REFRESH-XYZ"),
      oauthExpiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000),
      status: "active",
    })
    .returning();
  return row;
}

describe("getAccessTokenForAccount", () => {
  beforeEach(() => mockRefreshAccessToken.mockReset());

  it("returns cached token when not near expiry", async () => {
    const row = await seed({ expiresInSeconds: 3600 });
    const t = await getAccessTokenForAccount(row.id);
    expect(t).toBe("OLD-ACCESS");
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes when within the skew window", async () => {
    const row = await seed({ expiresInSeconds: 30 });
    mockRefreshAccessToken.mockResolvedValueOnce({
      accessToken: () => "NEW-ACCESS",
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
      refreshToken: () => "REFRESH-XYZ",
    });
    const t = await getAccessTokenForAccount(row.id);
    expect(t).toBe("NEW-ACCESS");
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce();

    const [after] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, row.id));
    expect(after.oauthExpiresAt.getTime()).toBeGreaterThan(
      Date.now() + 3000 * 1000
    );
  });

  it("persists rotated refresh token when Google returns a new one", async () => {
    const row = await seed({ expiresInSeconds: 30 });
    mockRefreshAccessToken.mockResolvedValueOnce({
      accessToken: () => "NEW-ACCESS",
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
      refreshToken: () => "REFRESH-ROTATED",
    });
    await getAccessTokenForAccount(row.id);

    const [after] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, row.id));
    const { decryptToken } = await import("@/lib/crypto/encrypt");
    expect(await decryptToken(after.oauthRefreshToken)).toBe("REFRESH-ROTATED");
  });

  it("returns the concurrently-written token when the optimistic lock prevents our write", async () => {
    const row = await seed({ expiresInSeconds: 30 });

    mockRefreshAccessToken.mockImplementationOnce(async () => {
      // Simulate a concurrent process winning the race by updating the row
      await db
        .update(emailAccounts)
        .set({
          oauthAccessToken: await encryptToken("CONCURRENT-ACCESS"),
          oauthExpiresAt: new Date(Date.now() + 3600_000),
        })
        .where(eq(emailAccounts.id, row.id));

      return {
        accessToken: () => "OUR-ACCESS",
        accessTokenExpiresAt: () => new Date(Date.now() + 3600_000),
        refreshToken: () => "REFRESH-XYZ",
      };
    });

    const token = await getAccessTokenForAccount(row.id);
    expect(token).toBe("CONCURRENT-ACCESS");
  });

  it("throws if account is not active", async () => {
    const row = await seed({ expiresInSeconds: 3600 });
    await db
      .update(emailAccounts)
      .set({ status: "revoked" })
      .where(eq(emailAccounts.id, row.id));
    await expect(getAccessTokenForAccount(row.id)).rejects.toThrow(/not active/);
  });
});

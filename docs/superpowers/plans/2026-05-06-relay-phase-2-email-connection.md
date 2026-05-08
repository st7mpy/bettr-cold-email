# Bettr Cold Email — Phase 2: Email account connection

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A signed-in user can click "Connect Gmail" on the settings page, complete Google's OAuth consent flow, return to the dashboard with their account showing as connected, and send a test email to themselves through the Gmail API. Refresh-token logic ensures sends keep working past the 1-hour access-token expiry.

**Architecture:** Hand-rolled OAuth 2.0 dance using `arctic` (lightweight TS-first OAuth library) for the redirect/exchange. Tokens stored AES-GCM-encrypted at rest in the existing `email_accounts` table. A central `getAccessTokenForAccount()` helper refreshes-on-demand before any send. Sending uses raw `fetch` against the Gmail API (no heavy `googleapis` package).

**Tech additions:** `arctic` (OAuth 2.0), `nanoid` (state tokens). Built-in Node `crypto.subtle` for AES-GCM. No new vendor deps.

**Out of scope (deferred):**
- **Microsoft Outlook** — same pattern, separate provider client. Folded into a Phase 2.5 follow-up plan once Google is shipping reliably.
- Push subscriptions for reply detection — Phase 4.
- Multiple connected accounts per user — partial unique index already restricts to one active.

---

## Pre-flight: Google Cloud Console setup

**You** need to do this once before Task 1. Approx 10 minutes.

- [ ] **Create a Google Cloud project** at https://console.cloud.google.com → New Project → name "bettr-cold-email"
- [ ] **Enable the Gmail API** → APIs & Services → Library → "Gmail API" → Enable
- [ ] **Configure OAuth consent screen** → APIs & Services → OAuth consent screen
  - User type: **External**
  - App name: **Bettr Cold Email**
  - User support email: your email
  - Developer contact: your email
  - **Scopes:** add three:
    - `.../auth/userinfo.email`
    - `.../auth/userinfo.profile`
    - `.../auth/gmail.send` (restricted)
    - `.../auth/gmail.modify` (restricted — needed Phase 4 for reply detection; add now to avoid re-consent later)
  - **Test users:** add your own email + 1–2 testing emails (you can add up to 100 without going through Google verification)
- [ ] **Create OAuth client credentials** → APIs & Services → Credentials → Create Credentials → OAuth client ID
  - Application type: **Web application**
  - Name: "bettr-cold-email-dev"
  - **Authorized redirect URIs:** `http://localhost:3001/api/oauth/google/callback` (we'll add the production URL later)
  - **Save** → copy the Client ID and Client secret
- [ ] **Drop these into `.env.local`** under the keys we'll add in Task 1:
  ```
  GOOGLE_OAUTH_CLIENT_ID=...
  GOOGLE_OAUTH_CLIENT_SECRET=...
  ```

---

## File structure (after Phase 2)

```
src/
├── app/
│   ├── api/
│   │   └── oauth/
│   │       └── google/
│   │           ├── start/route.ts       # initiates OAuth
│   │           └── callback/route.ts    # handles consent, stores tokens
│   └── dashboard/
│       └── settings/
│           ├── page.tsx                 # email accounts management UI
│           └── actions.ts               # disconnect, send-test server actions
├── lib/
│   ├── crypto/
│   │   ├── encrypt.ts                   # AES-GCM wrap/unwrap for tokens
│   │   └── encrypt.test.ts
│   ├── oauth/
│   │   ├── google.ts                    # Google OAuth client (arctic)
│   │   ├── state.ts                     # CSRF state cookie helpers
│   │   ├── state.test.ts
│   │   └── tokens.ts                    # getAccessTokenForAccount() — refresh on demand
│   │   └── tokens.test.ts
│   └── email/
│       ├── gmail.ts                     # send via Gmail API
│       └── gmail.test.ts
```

---

## Task 1: Add OAuth env vars and minimal config

**Files:**
- Modify: `.env.example`, `.env.local`

- [ ] **Step 1: Append to `.env.example`**

```bash
# Google OAuth (Phase 2)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Token encryption — generate with: node -e "console.log(crypto.randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=

# Public URL (used for OAuth redirects; set per environment)
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

- [ ] **Step 2: Generate an encryption key and write to `.env.local`**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output into `.env.local` as `ENCRYPTION_KEY=...`. Also paste your Google OAuth client ID + secret from pre-flight.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "feat(oauth): env vars for Google OAuth + token encryption key"
```

---

## Task 2: Install OAuth dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add arctic nanoid
```

`arctic` handles the OAuth dance (redirect URL building, token exchange, refresh) for many providers including Google. ~2 KB gzipped, TS-first, no transitive deps. `nanoid` for short URL-safe state tokens.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(oauth): add arctic + nanoid for OAuth flows"
```

---

## Task 3: AES-GCM token encryption (TDD)

**Files:**
- Create: `src/lib/crypto/encrypt.ts`, `src/lib/crypto/encrypt.test.ts`

OAuth refresh tokens are persistent credentials — losing one means an attacker can read the user's mail until revoked. We encrypt at rest with AES-256-GCM using `ENCRYPTION_KEY`.

- [ ] **Step 1: Write tests first**

Create `src/lib/crypto/encrypt.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "./encrypt";

beforeAll(() => {
  // 32 random bytes, base64
  process.env.ENCRYPTION_KEY = "ZHVtbXkta2V5LWZvci10ZXN0cy0zMmJ5dGUtbG9uZw==";
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a token", async () => {
    const plaintext = "ya29.a0Af-fake-access-token-1234567890";
    const wrapped = await encryptToken(plaintext);
    expect(wrapped).not.toContain(plaintext);
    expect(await decryptToken(wrapped)).toBe(plaintext);
  });

  it("produces different ciphertext on each call (random IV)", async () => {
    const a = await encryptToken("same-plaintext");
    const b = await encryptToken("same-plaintext");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", async () => {
    const wrapped = await encryptToken("hello");
    const tampered = wrapped.slice(0, -4) + "XXXX";
    await expect(decryptToken(tampered)).rejects.toThrow();
  });

  it("throws when ENCRYPTION_KEY is missing", async () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      await expect(encryptToken("hi")).rejects.toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });
});
```

- [ ] **Step 2: Run tests → fail**

```bash
pnpm test src/lib/crypto/encrypt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/crypto/encrypt.ts`:

```ts
// AES-256-GCM wrap/unwrap. Output format: base64(iv || ciphertext || tag)
// Uses Web Crypto so it runs in both Node and Edge runtimes.

const ALGO = { name: "AES-GCM", length: 256 } as const;
const IV_BYTES = 12;

function getKeyBytes(): Uint8Array {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to 32 bytes (256-bit key)");
  }
  return new Uint8Array(buf);
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", getKeyBytes(), ALGO, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { ...ALGO, iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return Buffer.concat([Buffer.from(iv), Buffer.from(ct)]).toString("base64");
}

export async function decryptToken(wrapped: string): Promise<string> {
  const buf = Buffer.from(wrapped, "base64");
  if (buf.length < IV_BYTES + 16) throw new Error("ciphertext too short");
  const iv = new Uint8Array(buf.subarray(0, IV_BYTES));
  const ct = new Uint8Array(buf.subarray(IV_BYTES));
  const key = await importKey();
  const pt = await crypto.subtle.decrypt({ ...ALGO, iv }, key, ct);
  return new TextDecoder().decode(pt);
}
```

- [ ] **Step 4: Run tests → pass**

```bash
pnpm test src/lib/crypto/encrypt.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto/
git commit -m "feat(crypto): AES-256-GCM token wrap/unwrap with random IV"
```

---

## Task 4: OAuth state + CSRF cookie helpers (TDD)

**Files:**
- Create: `src/lib/oauth/state.ts`, `src/lib/oauth/state.test.ts`

State protects against CSRF on the OAuth callback. We generate a random nonce, set it in an `httpOnly` cookie, include it in the auth URL, and verify it matches on callback.

- [ ] **Step 1: Write tests**

Create `src/lib/oauth/state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateState, verifyState } from "./state";

describe("generateState / verifyState", () => {
  it("produces a URL-safe token of reasonable length", () => {
    const s = generateState();
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s.length).toBeGreaterThanOrEqual(20);
  });

  it("two calls produce different states", () => {
    expect(generateState()).not.toBe(generateState());
  });

  it("verifyState returns true on exact match", () => {
    const s = generateState();
    expect(verifyState(s, s)).toBe(true);
  });

  it("verifyState returns false on mismatch", () => {
    expect(verifyState("aaa", "bbb")).toBe(false);
  });

  it("verifyState returns false when either side is empty/null", () => {
    expect(verifyState("", "x")).toBe(false);
    expect(verifyState(null, "x")).toBe(false);
    expect(verifyState("x", null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test src/lib/oauth/state.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/oauth/state.ts`:

```ts
import { nanoid } from "nanoid";
import { timingSafeEqual } from "node:crypto";

export const OAUTH_STATE_COOKIE = "bettr_oauth_state";

export function generateState(): string {
  return nanoid(24); // 24 chars, ~143 bits entropy
}

export function verifyState(
  cookieValue: string | null | undefined,
  callbackValue: string | null | undefined
): boolean {
  if (!cookieValue || !callbackValue) return false;
  if (cookieValue.length !== callbackValue.length) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(callbackValue);
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test src/lib/oauth/state.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauth/state.ts src/lib/oauth/state.test.ts
git commit -m "feat(oauth): CSRF state generator + timing-safe verifier"
```

---

## Task 5: Google OAuth start route

**Files:**
- Create: `src/lib/oauth/google.ts`, `src/app/api/oauth/google/start/route.ts`

- [ ] **Step 1: Define the OAuth client**

Create `src/lib/oauth/google.ts`:

```ts
import { Google } from "arctic";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function getGoogleClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / NEXT_PUBLIC_APP_URL"
    );
  }
  return new Google(
    clientId,
    clientSecret,
    `${appUrl}/api/oauth/google/callback`
  );
}
```

- [ ] **Step 2: Build the start route**

Create `src/app/api/oauth/google/start/route.ts`:

```ts
import { auth } from "@clerk/nextjs/server";
import { generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleClient, GOOGLE_SCOPES } from "@/lib/oauth/google";
import { generateState, OAUTH_STATE_COOKIE } from "@/lib/oauth/state";

const PKCE_COOKIE = "bettr_oauth_pkce";

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
  jar.set(PKCE_COOKIE, codeVerifier, cookieOptions);

  return NextResponse.redirect(url);
}
```

- [ ] **Step 3: Manual verify**

Start dev server, hit `http://localhost:3001/api/oauth/google/start` while signed in → should redirect to Google's consent page showing your scopes. Don't click Allow yet — Task 6 needs to be in place first to handle the callback.

```bash
pnpm dev --port 3001
# then in another terminal:
curl -s -o /dev/null -w "HTTP %{http_code} -> %{redirect_url}\n" \
  -b "__session=DUMMY" http://localhost:3001/api/oauth/google/start
# (signed-out hit returns redirect to /sign-in — that's the expected unauthorized path)
```

A signed-in browser hit would redirect to `accounts.google.com/o/oauth2/v2/auth?...`. We test that integratively in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/lib/oauth/google.ts src/app/api/oauth/google/
git commit -m "feat(oauth): Google OAuth start route + PKCE state cookies"
```

---

## Task 6: Google OAuth callback — token storage

**Files:**
- Create: `src/app/api/oauth/google/callback/route.ts`

This is the trickiest route. It must:
1. Validate state (CSRF)
2. Exchange code for tokens
3. Fetch the user's email from Google (so we know which account they connected)
4. Encrypt tokens
5. Upsert into `email_accounts` (replacing any existing active one for this user)
6. Redirect to settings

- [ ] **Step 1: Implement the callback**

Create `src/app/api/oauth/google/callback/route.ts`:

```ts
import { auth } from "@clerk/nextjs/server";
import { OAuth2RequestError } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getGoogleClient } from "@/lib/oauth/google";
import { OAUTH_STATE_COOKIE, verifyState } from "@/lib/oauth/state";
import { encryptToken } from "@/lib/crypto/encrypt";

const PKCE_COOKIE = "bettr_oauth_pkce";

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
  const codeVerifier = jar.get(PKCE_COOKIE)?.value;

  // Always clear cookies — they're single-use
  jar.delete(OAUTH_STATE_COOKIE);
  jar.delete(PKCE_COOKIE);

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
  const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfo.ok) {
    return settingsRedirect("error=userinfo_failed");
  }
  const { email } = (await userInfo.json()) as { email?: string };
  if (!email) return settingsRedirect("error=no_email");

  // Mark any existing active account for this user as revoked first,
  // then insert the new one. (Partial unique index allows only one active.)
  await db.transaction(async (tx) => {
    await tx
      .update(emailAccounts)
      .set({ status: "revoked" })
      .where(
        and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active"))
      );
    await tx.insert(emailAccounts).values({
      userId,
      provider: "gmail",
      oauthAccessToken: await encryptToken(accessToken),
      oauthRefreshToken: await encryptToken(refreshToken),
      oauthExpiresAt: accessTokenExpiresAt,
      status: "active",
      // dailyQuota stays at default (50, ramps up — handled in Phase 4)
    });
  });

  return settingsRedirect(`connected=${encodeURIComponent(email)}`);
}
```

- [ ] **Step 2: Manual verify (after Task 9 builds the UI button)**

Will integration-test through the browser when the settings page is up. Skip standalone verification of the callback — its behavior is dependent on the full flow.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/oauth/google/callback/route.ts
git commit -m "feat(oauth): Google OAuth callback — exchange, fetch email, store encrypted tokens"
```

---

## Task 7: Token refresh helper (TDD)

**Files:**
- Create: `src/lib/oauth/tokens.ts`, `src/lib/oauth/tokens.test.ts`

Every send goes through `getAccessTokenForAccount(accountId)`. If the access token is within 60s of expiry, refresh it, persist the new value, and return it.

- [ ] **Step 1: Write tests with mocked `arctic`**

Create `src/lib/oauth/tokens.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { emailAccounts, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "@/lib/crypto/encrypt";

const mockRefreshAccessToken = vi.fn();

vi.mock("@/lib/oauth/google", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    getGoogleClient: () => ({
      refreshAccessToken: mockRefreshAccessToken,
    }),
  };
});

beforeEach(() => {
  process.env.ENCRYPTION_KEY ??=
    "ZHVtbXkta2V5LWZvci10ZXN0cy0zMmJ5dGUtbG9uZw==";
});

const { getAccessTokenForAccount } = await import("./tokens");

const TEST_USER_ID = "user_test_tokens_phase2";

async function seed(opts: { expiresInSeconds: number }) {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: "tokens-test@example.com",
  }).onConflictDoNothing();

  // Wipe any prior accounts
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
      refreshToken: () => "REFRESH-XYZ", // Google sometimes re-issues, sometimes not
    });
    const t = await getAccessTokenForAccount(row.id);
    expect(t).toBe("NEW-ACCESS");
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce();

    // Persisted
    const [after] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, row.id));
    expect(after.oauthExpiresAt.getTime()).toBeGreaterThan(Date.now() + 3000 * 1000);
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
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test src/lib/oauth/tokens.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/oauth/tokens.ts`:

```ts
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/lib/crypto/encrypt";
import { getGoogleClient } from "@/lib/oauth/google";

const REFRESH_SKEW_MS = 60_000; // refresh if expires within 60s

export async function getAccessTokenForAccount(accountId: string): Promise<string> {
  const [row] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId));
  if (!row) throw new Error(`email account ${accountId} not found`);
  if (row.status !== "active") {
    throw new Error(`email account ${accountId} is not active (status=${row.status})`);
  }

  const expiresAt = row.oauthExpiresAt.getTime();
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return decryptToken(row.oauthAccessToken);
  }

  // Need to refresh
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
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test src/lib/oauth/tokens.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauth/tokens.ts src/lib/oauth/tokens.test.ts
git commit -m "feat(oauth): refresh-on-demand access token helper with rotation support"
```

---

## Task 8: Send a test email via Gmail API

**Files:**
- Create: `src/lib/email/gmail.ts`, `src/lib/email/gmail.test.ts`

- [ ] **Step 1: Write tests with `fetch` mocked**

Create `src/lib/email/gmail.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendGmailMessage } from "./gmail";

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

describe("sendGmailMessage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("base64url-encodes the RFC822 body and posts to the Gmail send endpoint", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      captured.url = String(url);
      captured.init = init;
      return new Response(JSON.stringify({ id: "msg_123", threadId: "th_456" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await sendGmailMessage({
      accessToken: "ACCESS",
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Test 👋",
      body: "Hello world",
    });

    expect(result).toEqual({ messageId: "msg_123", threadId: "th_456" });
    expect(captured.url).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    );
    expect((captured.init?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer ACCESS"
    );
    const payload = JSON.parse(captured.init?.body as string);
    expect(payload.raw).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    const decoded = Buffer.from(
      payload.raw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    expect(decoded).toContain("From: sender@example.com");
    expect(decoded).toContain("To: recipient@example.com");
    expect(decoded).toContain("Subject:");
    expect(decoded).toContain("Hello world");
  });

  it("throws on non-2xx", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "boom" } }), { status: 401 })
    ) as unknown as typeof fetch;

    await expect(
      sendGmailMessage({
        accessToken: "x",
        from: "a@b.com",
        to: "c@d.com",
        subject: "s",
        body: "b",
      })
    ).rejects.toThrow(/401.*boom/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test src/lib/email/gmail.test.ts
```

- [ ] **Step 3: Implement**

Create `src/lib/email/gmail.ts`:

```ts
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

interface SendArgs {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

interface SendResult {
  messageId: string;
  threadId: string;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc822(args: SendArgs): string {
  // Gmail accepts UTF-8 if we mark Content-Type properly. The MIME-encoded
  // subject handles non-ASCII characters like emoji.
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(args.subject, "utf8").toString("base64")}?=`;
  return [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${subjectEncoded}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    args.body,
  ].join("\r\n");
}

export async function sendGmailMessage(args: SendArgs): Promise<SendResult> {
  const raw = base64url(Buffer.from(buildRfc822(args), "utf8"));
  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text)?.error?.message ?? text;
    } catch {
      // ignore
    }
    throw new Error(`Gmail send failed: ${res.status} ${msg}`);
  }
  const json = JSON.parse(text) as { id: string; threadId: string };
  return { messageId: json.id, threadId: json.threadId };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test src/lib/email/gmail.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/
git commit -m "feat(email): send via Gmail API with UTF-8 MIME encoding"
```

---

## Task 9: Settings → Email accounts page (UI + actions)

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`, `src/app/dashboard/settings/actions.ts`
- Modify: `src/app/dashboard/page.tsx` (add a banner pointing to settings if no account connected)

- [ ] **Step 1: Server actions**

Create `src/app/dashboard/settings/actions.ts`:

```ts
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAccessTokenForAccount } from "@/lib/oauth/tokens";
import { sendGmailMessage } from "@/lib/email/gmail";

export async function disconnectAccount(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthenticated");
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) throw new Error("missing accountId");

  await db
    .update(emailAccounts)
    .set({ status: "revoked" })
    .where(
      and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId))
    );
  revalidatePath("/dashboard/settings");
}

export async function sendTestEmail(
  formData: FormData
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthenticated" };

  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return { ok: false, error: "missing accountId" };

  const [acct] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId))
    );
  if (!acct) return { ok: false, error: "not found" };

  const accessToken = await getAccessTokenForAccount(acct.id);
  const me = await currentUser();
  const myEmail =
    me?.primaryEmailAddress?.emailAddress ?? me?.emailAddresses[0]?.emailAddress;
  if (!myEmail) return { ok: false, error: "no clerk email on user" };

  // Recipient = the connected mailbox (we'll send to it as a self-test)
  const userInfo = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const { email: connectedEmail } = (await userInfo.json()) as { email: string };

  const { messageId } = await sendGmailMessage({
    accessToken,
    from: connectedEmail,
    to: connectedEmail,
    subject: "Bettr Cold Email — connection test ✅",
    body: [
      "This is a test email from Bettr Cold Email.",
      "",
      "If you're reading this in your inbox, the connection is working correctly.",
      "",
      "— Bettr Cold Email",
    ].join("\r\n"),
  });
  return { ok: true, messageId };
}
```

- [ ] **Step 2: Settings page**

Create `src/app/dashboard/settings/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { disconnectAccount, sendTestEmail } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; tested?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;

  const accounts = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.userId, userId), ne(emailAccounts.status, "revoked"))
    );

  const active = accounts[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connect the inbox you want to send from.
        </p>
      </div>

      {params.connected && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Connected{" "}
          <span className="font-medium">{decodeURIComponent(params.connected)}</span>{" "}
          successfully.
        </div>
      )}
      {params.tested && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Test email sent. Check your inbox.
        </div>
      )}
      {params.error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          OAuth failed: {decodeURIComponent(params.error)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email account</CardTitle>
          <CardDescription>
            Bettr Cold Email sends from your own Gmail. Replies thread back to
            your inbox naturally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!active ? (
            <a href="/api/oauth/google/start">
              <Button>Connect Gmail</Button>
            </a>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Provider:</span>{" "}
                <span className="font-medium">Gmail</span>
                <span className="ml-4 text-muted-foreground">Status:</span>{" "}
                <span className="font-medium capitalize">{active.status}</span>
              </div>
              <div className="flex gap-2">
                <form action={async (fd) => {
                  "use server";
                  const result = await sendTestEmail(fd);
                  const { redirect } = await import("next/navigation");
                  if (result.ok) redirect("/dashboard/settings?tested=1");
                  redirect(
                    `/dashboard/settings?error=${encodeURIComponent(result.error)}`
                  );
                }}>
                  <input type="hidden" name="accountId" value={active.id} />
                  <Button type="submit" variant="outline">
                    Send test email
                  </Button>
                </form>
                <form action={disconnectAccount}>
                  <input type="hidden" name="accountId" value={active.id} />
                  <Button type="submit" variant="ghost">
                    Disconnect
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Add a banner on the dashboard pointing to settings if no account connected**

Modify `src/app/dashboard/page.tsx` — replace the existing "No campaigns yet" card with one that adapts to connection status:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [active] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active"))
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Outreach you've launched.</p>
      </div>

      {!active ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect your inbox to get started</CardTitle>
            <CardDescription>
              Bettr Cold Email sends from your own Gmail or Outlook. Connect an
              account to enable campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings">
              <Button>Go to settings</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>Upload your first list of leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Coming in Phase 3</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat(settings): email-account connect/disconnect/test UI + actions"
```

---

## Task 10: Full smoke test + tag + push

**Files:** none

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all suites pass — schema, auth, encrypt, state, tokens, gmail.

- [ ] **Step 2: Typecheck + build**

```bash
pnpm exec tsc --noEmit
pnpm build
```

- [ ] **Step 3: Manual end-to-end smoke test**

```bash
pnpm dev --port 3001
```

In a browser:
1. Visit `http://localhost:3001` → click "Sign in" → auth via Clerk
2. Land on `/dashboard` → should see "Connect your inbox to get started" card
3. Click "Go to settings" → see "Connect Gmail" button
4. Click "Connect Gmail" → redirected to Google consent screen
5. Click Allow → redirected back to `/dashboard/settings?connected=<your_email>`
6. Page now shows the connected account with "Send test email" + "Disconnect" buttons
7. Click "Send test email" → green confirmation appears
8. Check your Gmail inbox → email "Bettr Cold Email — connection test ✅" should be there
9. Click "Disconnect" → connection removed, back to "Connect Gmail" state

- [ ] **Step 4: Tag + push**

```bash
git tag phase-2-complete
git push origin main --tags
```

---

## Self-review

**Spec coverage:** Phase 2 implements §7.1 of the spec (Gmail sending mechanics + token storage), partially §11 row 1 (Google OAuth scopes — flagging this as a finite-test-user concern in the plan), and §11 row 6 (encryption at rest for refresh tokens — addressed via AES-GCM wrap). It does NOT cover Outlook (deferred to Phase 2.5), pacing/throttling (Phase 4), or push subscriptions for replies (Phase 4). All deferred items explicit.

**Placeholders:** None — every step has runnable commands or full code.

**Type consistency:** `getAccessTokenForAccount(accountId: string): Promise<string>` signature consistent in `tokens.ts` (Task 7), `tokens.test.ts` (Task 7), and `actions.ts` (Task 9). `sendGmailMessage` arg shape consistent across `gmail.ts`, `gmail.test.ts`, and `actions.ts`. Token-encryption helpers `encryptToken/decryptToken` are async-returning-string in all callers.

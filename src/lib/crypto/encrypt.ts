// AES-256-GCM wrap/unwrap for tokens at rest.
// Output format: base64(iv || ciphertext || authTag)
// Uses Web Crypto so the same code runs in Node and Edge runtimes.

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

import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "./encrypt";

beforeAll(() => {
  // 32 zero bytes, base64 — deterministic test key
  process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
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

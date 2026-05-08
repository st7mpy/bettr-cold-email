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
      return new Response(
        JSON.stringify({ id: "msg_123", threadId: "th_456" }),
        { status: 200 }
      );
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
    expect(
      (captured.init?.headers as Record<string, string>)["Authorization"]
    ).toBe("Bearer ACCESS");
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
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "boom" } }), {
          status: 401,
        })
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

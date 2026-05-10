import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
});

const { wrapTrackingForBody } = await import("./wrap");

describe("wrapTrackingForBody", () => {
  it("rewrites every http/https URL through the click endpoint", () => {
    const out = wrapTrackingForBody({
      emailId: "e1",
      body: "Hi! See https://acme.com/x and http://foo.bar/y here.",
    });
    expect(out.body).toMatch(
      /https:\/\/app\.example\.com\/api\/track\/click\/e1\?to=[A-Za-z0-9_-]+/
    );
    // both URLs got wrapped
    const matches = out.body.match(/\/api\/track\/click\/e1\?to=/g);
    expect(matches?.length).toBe(2);
  });

  it("appends an unsubscribe footer", () => {
    const out = wrapTrackingForBody({ emailId: "e2", body: "hello" });
    expect(out.body).toContain(
      "Unsubscribe: https://app.example.com/api/unsubscribe/e2"
    );
    expect(out.unsubscribeUrl).toBe(
      "https://app.example.com/api/unsubscribe/e2"
    );
  });

  it("produces a pixel URL for the email id", () => {
    const out = wrapTrackingForBody({ emailId: "e3", body: "x" });
    expect(out.pixelUrl).toBe(
      "https://app.example.com/api/track/open/e3.gif"
    );
  });
});

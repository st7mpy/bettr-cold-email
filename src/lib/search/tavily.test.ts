import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env.TAVILY_API_KEY = "tvly-test";
});
afterAll(() => server.close());
beforeEach(() => server.resetHandlers());

const { tavilySearch, tavilyExtract } = await import("./tavily");

describe("tavilySearch", () => {
  it("posts to /search with the query and returns the result list", async () => {
    let captured: { query?: string } | undefined;
    server.use(
      http.post("https://api.tavily.com/search", async ({ request }) => {
        captured = (await request.json()) as { query?: string };
        return HttpResponse.json({
          results: [
            { url: "https://example.com/a", title: "A", content: "snippet a" },
            { url: "https://example.com/b", title: "B", content: "snippet b" },
          ],
        });
      })
    );
    const out = await tavilySearch({ query: 'foo "bar"' });
    expect(captured?.query).toBe('foo "bar"');
    expect(out).toHaveLength(2);
    expect(out[0].url).toBe("https://example.com/a");
  });

  it("throws on non-2xx", async () => {
    server.use(
      http.post("https://api.tavily.com/search", () =>
        HttpResponse.json({ message: "rate limit" }, { status: 429 })
      )
    );
    await expect(tavilySearch({ query: "x" })).rejects.toThrow(/429/);
  });
});

describe("tavilyExtract", () => {
  it("posts to /extract and returns markdown per URL", async () => {
    server.use(
      http.post("https://api.tavily.com/extract", () =>
        HttpResponse.json({
          results: [
            { url: "https://example.com/a", raw_content: "# heading\n\nbody" },
          ],
        })
      )
    );
    const out = await tavilyExtract(["https://example.com/a"]);
    expect(out).toEqual([
      { url: "https://example.com/a", content: "# heading\n\nbody" },
    ]);
  });

  it("returns [] for empty url list (skips API call)", async () => {
    // No handler registered — if called, msw would error
    const out = await tavilyExtract([]);
    expect(out).toEqual([]);
  });
});

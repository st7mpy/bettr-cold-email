import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { z } from "zod";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
  process.env.ANTHROPIC_OPUS_MODEL = "claude-opus-4-7";
  process.env.ANTHROPIC_HAIKU_MODEL = "claude-haiku-4-5";
});
afterAll(() => server.close());
beforeEach(() => server.resetHandlers());

const { callHaiku, callOpus, callHaikuStructured } = await import("./claude");

describe("callHaiku / callOpus", () => {
  it("hits the messages endpoint with the configured Haiku model", async () => {
    let capturedBody: { model?: string } | undefined;
    server.use(
      http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
        capturedBody = (await request.json()) as { model?: string };
        return HttpResponse.json({
          id: "msg_x",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "ack" }],
          model: "claude-haiku-4-5",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      })
    );
    const out = await callHaiku({ system: "s", user: "u" });
    expect(out).toBe("ack");
    expect(capturedBody?.model).toBe("claude-haiku-4-5");
  });

  it("uses the Opus model when callOpus is invoked", async () => {
    let capturedBody: { model?: string } | undefined;
    server.use(
      http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
        capturedBody = (await request.json()) as { model?: string };
        return HttpResponse.json({
          id: "msg_y",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "ok" }],
          model: "claude-opus-4-7",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      })
    );
    await callOpus({ system: "s", user: "u" });
    expect(capturedBody?.model).toBe("claude-opus-4-7");
  });
});

describe("callHaikuStructured", () => {
  const Schema = z.object({ classification: z.string(), confidence: z.number() });

  it("parses structured JSON output against the provided zod schema", async () => {
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({
          id: "msg_s",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "text",
              text: '{"classification":"positive","confidence":0.92}',
            },
          ],
          model: "claude-haiku-4-5",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        })
      )
    );
    const out = await callHaikuStructured({
      system: "s",
      user: "u",
      schema: Schema,
    });
    expect(out).toEqual({ classification: "positive", confidence: 0.92 });
  });

  it("throws when the response cannot be parsed against the schema", async () => {
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({
          id: "msg_bad",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"wrong":"shape"}' }],
          model: "claude-haiku-4-5",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        })
      )
    );
    await expect(
      callHaikuStructured({ system: "s", user: "u", schema: Schema })
    ).rejects.toThrow();
  });

  it("tolerates fenced code blocks around the JSON", async () => {
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({
          id: "msg_fence",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "text",
              text: '```json\n{"classification":"q","confidence":0.5}\n```',
            },
          ],
          model: "claude-haiku-4-5",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        })
      )
    );
    const out = await callHaikuStructured({
      system: "s",
      user: "u",
      schema: Schema,
    });
    expect(out.classification).toBe("q");
  });
});

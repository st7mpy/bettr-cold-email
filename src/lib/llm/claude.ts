import Anthropic from "@anthropic-ai/sdk";
import { z, ZodSchema } from "zod";

let _client: Anthropic | null = null;

function client() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

interface CallArgs {
  system: string;
  user: string;
  maxTokens?: number;
  /**
   * When true, the system prompt is sent as a cacheable block
   * (cache_control: ephemeral). Use for long, stable system prompts that
   * are repeated across many leads in a campaign.
   */
  cacheSystem?: boolean;
}

function modelFor(tier: "opus" | "sonnet" | "haiku"): string {
  if (tier === "opus") {
    return process.env.ANTHROPIC_OPUS_MODEL || "claude-opus-4-7";
  }
  if (tier === "sonnet") {
    return process.env.ANTHROPIC_SONNET_MODEL || "claude-sonnet-4-6";
  }
  return process.env.ANTHROPIC_HAIKU_MODEL || "claude-haiku-4-5-20251001";
}

async function callTier(
  tier: "opus" | "sonnet" | "haiku",
  args: CallArgs,
  // When set, prefills the assistant turn with this string. The string is
  // automatically prepended to the returned text. Use "{" to force JSON output.
  prefill?: string
): Promise<string> {
  const systemBlock = args.cacheSystem
    ? [
        {
          type: "text" as const,
          text: args.system,
          cache_control: { type: "ephemeral" as const },
        },
      ]
    : args.system;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: args.user },
  ];
  if (prefill !== undefined) {
    messages.push({ role: "assistant", content: prefill });
  }

  const res = await client().messages.create({
    model: modelFor(tier),
    max_tokens: args.maxTokens ?? 1024,
    system: systemBlock,
    messages,
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  // The Anthropic API returns only the continuation after the prefilled
  // assistant turn, so we re-prepend it here. Mocks (and some SDKs) sometimes
  // echo the prefill in the response — guard against double-prepending.
  if (prefill && !block.text.startsWith(prefill)) {
    return prefill + block.text;
  }
  return block.text;
}

export async function callHaiku(args: CallArgs): Promise<string> {
  return callTier("haiku", args);
}

export async function callSonnet(args: CallArgs): Promise<string> {
  return callTier("sonnet", args);
}

export async function callOpus(args: CallArgs): Promise<string> {
  return callTier("opus", args);
}

interface StructuredArgs<T> extends CallArgs {
  schema: ZodSchema<T>;
}

function extractJson(text: string): string {
  // 1. Fenced code block: ```json {...} ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();

  // 2. First balanced { ... } object (handles models that emit prose around JSON)
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];

  return text.trim();
}

async function structuredCall<T>(
  tier: "opus" | "sonnet" | "haiku",
  args: StructuredArgs<T>
): Promise<T> {
  // First attempt: prefill assistant turn with "{" so the model is forced to
  // continue valid JSON. This eliminates the "I'll be honest..." prose-instead-
  // of-JSON failure mode we hit in production.
  let raw: string;
  try {
    raw = await callTier(tier, args, "{");
    const json = JSON.parse(extractJson(raw));
    return args.schema.parse(json);
  } catch (firstErr) {
    // Second attempt: append a hard reminder and retry without prefill, so the
    // model can self-correct if it got off-rails on the first try (e.g. emitted
    // commentary inside the JSON).
    try {
      raw = await callTier(
        tier,
        {
          ...args,
          user:
            args.user +
            "\n\nIMPORTANT: Respond with raw JSON only, no prose, no markdown fences. Start your response with `{` and end with `}`.",
        },
        "{"
      );
      const json = JSON.parse(extractJson(raw));
      return args.schema.parse(json);
    } catch {
      // Surface the first error — it's usually more informative
      throw firstErr;
    }
  }
}

export async function callHaikuStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  return structuredCall("haiku", args);
}

export async function callSonnetStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  return structuredCall("sonnet", args);
}

export async function callOpusStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  return structuredCall("opus", args);
}

export { z };

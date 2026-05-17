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
  args: CallArgs
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

  const res = await client().messages.create({
    model: modelFor(tier),
    max_tokens: args.maxTokens ?? 1024,
    system: systemBlock,
    messages: [{ role: "user", content: args.user }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text block");
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
  // Tolerate fenced code blocks (```json ... ```) and bare JSON
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text.trim();
}

export async function callHaikuStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  const raw = await callHaiku(args);
  const json = JSON.parse(extractJson(raw));
  return args.schema.parse(json);
}

export async function callSonnetStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  const raw = await callSonnet(args);
  const json = JSON.parse(extractJson(raw));
  return args.schema.parse(json);
}

export async function callOpusStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  const raw = await callOpus(args);
  const json = JSON.parse(extractJson(raw));
  return args.schema.parse(json);
}

export { z };

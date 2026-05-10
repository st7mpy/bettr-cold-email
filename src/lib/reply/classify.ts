import { z } from "zod";
import { callHaikuStructured, callOpusStructured } from "@/lib/llm/claude";

export type Classification =
  | "positive"
  | "negative"
  | "out_of_office"
  | "unsubscribe"
  | "question"
  | "unrelated";

export interface ClassificationResult {
  classification: Classification;
  confidence: number; // 0..1
  summary: string;
  killWordHit?: string;
}

const KILL_WORDS = [
  "unsubscribe",
  "remove me",
  "stop emailing",
  "take me off",
  "do not contact",
  "please stop",
];

const Schema = z.object({
  classification: z.enum([
    "positive",
    "negative",
    "out_of_office",
    "unsubscribe",
    "question",
    "unrelated",
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(300),
});

const SYSTEM = `You classify cold-email replies. Return strict JSON matching:
{ "classification": one of [positive, negative, out_of_office, unsubscribe, question, unrelated], "confidence": 0..1, "summary": "<= 200 chars" }

Definitions:
- positive: interest, willing to talk, asks for time/info to evaluate buying/partnering
- negative: explicit no, not interested, wrong fit
- out_of_office: auto-reply, vacation, parental leave, no human read
- unsubscribe: asks to be removed, stop emailing, take off list
- question: asks a clarifying question that needs a human reply before progressing
- unrelated: bounce-back from gateway, security warning, not a real reply

Output ONLY the JSON object. No prose.`;

export async function classifyReply(args: {
  subject?: string;
  body: string;
}): Promise<ClassificationResult> {
  const lower = args.body.toLowerCase();
  for (const w of KILL_WORDS) {
    if (lower.includes(w)) {
      return {
        classification: "unsubscribe",
        confidence: 1,
        summary: `Kill-word matched: "${w}"`,
        killWordHit: w,
      };
    }
  }

  const userMsg = `Subject: ${args.subject ?? "(none)"}\n\nBody:\n${args.body.slice(0, 4000)}`;

  const first = await callHaikuStructured({
    system: SYSTEM,
    user: userMsg,
    schema: Schema,
    maxTokens: 256,
  });

  if (first.confidence >= 0.85) return first;

  // Escalate to Opus for low-confidence cases
  const second = await callOpusStructured({
    system: SYSTEM,
    user: userMsg,
    schema: Schema,
    maxTokens: 256,
  });
  return second;
}

export { KILL_WORDS };

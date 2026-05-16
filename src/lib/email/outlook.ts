import type { SendArgs, SendResult } from "./gmail";

type OutlookArgs = Omit<SendArgs, "accessToken">;

const GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail";

export async function sendOutlookMessage(
  accessToken: string,
  args: OutlookArgs
): Promise<SendResult> {
  const toRecipients = [{ emailAddress: { address: args.to } }];

  const internetMessageHeaders: { name: string; value: string }[] = [];
  if (args.headers) {
    for (const [name, value] of Object.entries(args.headers)) {
      internetMessageHeaders.push({ name, value });
    }
  }

  const message: Record<string, unknown> = {
    subject: args.subject,
    body: {
      contentType: "Text",
      content: args.body,
    },
    toRecipients,
    ...(internetMessageHeaders.length > 0 ? { internetMessageHeaders } : {}),
  };

  const res = await fetch(GRAPH_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = (JSON.parse(text) as { error?: { message?: string } })?.error?.message ?? text;
    } catch {
      // ignore
    }
    throw new Error(`Outlook send failed: ${res.status} ${msg}`);
  }

  // Graph sendMail returns 202 with no body; no messageId available without a follow-up List call
  return { messageId: `outlook-${Date.now()}`, threadId: "" };
}

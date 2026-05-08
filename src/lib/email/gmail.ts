const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export interface SendArgs {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc822(args: SendArgs): string {
  // MIME-encode the subject so non-ASCII characters (emoji, accents) survive
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(args.subject, "utf8").toString(
    "base64"
  )}?=`;
  return [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    args.body,
  ].join("\r\n");
}

export async function sendGmailMessage(args: SendArgs): Promise<SendResult> {
  const raw = base64url(Buffer.from(buildRfc822(args), "utf8"));
  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text)?.error?.message ?? text;
    } catch {
      // ignore
    }
    throw new Error(`Gmail send failed: ${res.status} ${msg}`);
  }
  const json = JSON.parse(text) as { id: string; threadId: string };
  return { messageId: json.id, threadId: json.threadId };
}

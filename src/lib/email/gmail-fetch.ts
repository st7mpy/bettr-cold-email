/**
 * Minimal Gmail message fetching for reply detection.
 * We use list+get rather than the history API so we don't have to track
 * historyId state. This is the polling fallback path.
 */

const LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GET_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export interface GmailMessage {
  id: string;
  threadId: string;
  headers: Record<string, string>;
  snippet: string;
  body: string;
  fromAddress: string;
  subject: string;
  inReplyTo?: string;
  references?: string;
}

export async function listGmailMessages(args: {
  accessToken: string;
  query: string;
  maxResults?: number;
}): Promise<{ id: string; threadId: string }[]> {
  const params = new URLSearchParams({
    q: args.query,
    maxResults: String(args.maxResults ?? 25),
  });
  const res = await fetch(`${LIST_URL}?${params}`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail list failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    messages?: { id: string; threadId: string }[];
  };
  return json.messages ?? [];
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );
}

interface GmailApiPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailApiPart[];
}

function extractTextBody(payload: GmailApiPart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = extractTextBody(p);
      if (t) return t;
    }
  }
  return "";
}

export async function getGmailMessage(args: {
  accessToken: string;
  id: string;
}): Promise<GmailMessage> {
  const res = await fetch(`${GET_URL}/${args.id}?format=full`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail get failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    id: string;
    threadId: string;
    snippet: string;
    payload: GmailApiPart & {
      headers?: { name: string; value: string }[];
    };
  };
  const headers: Record<string, string> = {};
  for (const h of json.payload.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }
  const body = extractTextBody(json.payload) || json.snippet;
  const fromHeader = headers["from"] ?? "";
  const fromAddrMatch = fromHeader.match(/<([^>]+)>/);
  const fromAddress = (fromAddrMatch ? fromAddrMatch[1] : fromHeader).trim();
  return {
    id: json.id,
    threadId: json.threadId,
    headers,
    snippet: json.snippet,
    body,
    fromAddress,
    subject: headers["subject"] ?? "",
    inReplyTo: headers["in-reply-to"],
    references: headers["references"],
  };
}

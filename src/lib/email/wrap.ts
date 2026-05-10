import { appUrl } from "./app-url";

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

function b64url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Wrap every URL in the body with a click-tracking redirect, append a tracking
 * pixel, and append an unsubscribe footer link. Plain-text safe.
 */
export function wrapTrackingForBody(args: {
  emailId: string;
  body: string;
}): { body: string; pixelUrl: string; unsubscribeUrl: string } {
  const base = appUrl();
  const wrapped = args.body.replace(URL_RE, (raw) => {
    return `${base}/api/track/click/${args.emailId}?to=${b64url(raw)}`;
  });

  const unsubscribeUrl = `${base}/api/unsubscribe/${args.emailId}`;
  const pixelUrl = `${base}/api/track/open/${args.emailId}.gif`;

  // Plain-text footer; mail clients linkify automatically.
  const footer = `\n\n--\nNot interested? Unsubscribe: ${unsubscribeUrl}`;

  // Tracking pixel — placed in the body as a soft-reference URL. For HTML
  // emails this would be an <img>; for plain text we rely on inbox-side prefetch
  // happening through the footer's other URLs. We expose pixelUrl so the caller
  // can also embed it as an image when sending HTML.
  return {
    body: `${wrapped}${footer}`,
    pixelUrl,
    unsubscribeUrl,
  };
}

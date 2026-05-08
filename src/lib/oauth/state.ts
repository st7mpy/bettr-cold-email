import { nanoid } from "nanoid";
import { timingSafeEqual } from "node:crypto";

export const OAUTH_STATE_COOKIE = "bettr_oauth_state";
export const OAUTH_PKCE_COOKIE = "bettr_oauth_pkce";

export function generateState(): string {
  return nanoid(24); // ~143 bits entropy, URL-safe
}

export function verifyState(
  cookieValue: string | null | undefined,
  callbackValue: string | null | undefined
): boolean {
  if (!cookieValue || !callbackValue) return false;
  if (cookieValue.length !== callbackValue.length) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(callbackValue);
  return timingSafeEqual(a, b);
}

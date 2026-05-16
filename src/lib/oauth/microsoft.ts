import { MicrosoftEntraId } from "arctic";

export const MICROSOFT_SCOPES = [
  "offline_access",
  "openid",
  "email",
  "profile",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.ReadWrite",
];

export function getMicrosoftClient(): MicrosoftEntraId {
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Missing MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / NEXT_PUBLIC_APP_URL"
    );
  }
  return new MicrosoftEntraId(
    tenantId,
    clientId,
    clientSecret,
    `${appUrl}/api/oauth/microsoft/callback`
  );
}

import { sendGmailMessage, type SendArgs, type SendResult } from "./gmail";
import { sendOutlookMessage } from "./outlook";

export interface ProviderAccount {
  provider: "gmail" | "outlook";
}

// SendArgs includes accessToken for the Gmail call; dispatcher takes it separately
export type MessageArgs = Omit<SendArgs, "accessToken">;

export async function sendMessage(
  account: ProviderAccount,
  accessToken: string,
  args: MessageArgs
): Promise<SendResult> {
  if (account.provider === "outlook") {
    return sendOutlookMessage(accessToken, args);
  }
  return sendGmailMessage({ ...args, accessToken });
}

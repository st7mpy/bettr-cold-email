import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ensureUserRow } from "@/lib/auth";

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string | null;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook secret not configured" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: ClerkUserCreatedEvent;
  try {
    event = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const primary = event.data.email_addresses.find(
    (e) => e.id === event.data.primary_email_address_id
  );
  const email =
    primary?.email_address ?? event.data.email_addresses[0]?.email_address;

  if (!email) {
    return NextResponse.json({ error: "no email on user" }, { status: 400 });
  }

  await ensureUserRow({ clerkId: event.data.id, email });
  return NextResponse.json({ ok: true });
}

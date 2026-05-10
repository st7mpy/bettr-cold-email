import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emails, leads, campaigns, suppressionList } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function suppress(emailId: string): Promise<{
  ok: boolean;
  email?: string;
}> {
  const [email] = await db.select().from(emails).where(eq(emails.id, emailId));
  if (!email) return { ok: false };
  const [lead] = await db.select().from(leads).where(eq(leads.id, email.leadId));
  if (!lead) return { ok: false };
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, lead.campaignId));
  if (!campaign) return { ok: false };

  await db
    .insert(suppressionList)
    .values({
      userId: campaign.userId,
      email: lead.email,
      reason: "unsubscribed_link",
    })
    .onConflictDoNothing();

  await db
    .update(leads)
    .set({ status: "stopped" })
    .where(eq(leads.id, lead.id));

  return { ok: true, email: lead.email };
}

function html(body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe</title>
<style>body{font-family:system-ui;max-width:520px;margin:60px auto;padding:0 24px;color:#111}h1{font-size:1.4rem}button{padding:.6rem 1rem;font-size:1rem;cursor:pointer;border:1px solid #111;background:#fff;border-radius:4px}.ok{color:#0a7}</style>
</head><body>${body}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;
  return html(`
    <h1>Unsubscribe</h1>
    <p>Click the button below to confirm — we'll stop emailing you immediately.</p>
    <form method="POST" action="/api/unsubscribe/${emailId}">
      <button type="submit">Unsubscribe me</button>
    </form>
  `);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;
  const r = await suppress(emailId);
  if (!r.ok) {
    return html(`<h1>Unsubscribe</h1><p>We couldn't find this address. It may already be removed.</p>`);
  }

  // RFC 8058 One-Click Unsubscribe support: respond with success regardless of UA
  if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    return html(
      `<h1>Unsubscribed <span class="ok">✓</span></h1><p>${r.email} will no longer receive messages.</p>`
    );
  }
  return new NextResponse(null, { status: 200 });
}

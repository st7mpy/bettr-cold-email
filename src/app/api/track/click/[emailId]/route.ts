import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

function decodeB64Url(s: string): string | null {
  try {
    return Buffer.from(
      s.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;
  const to = req.nextUrl.searchParams.get("to");
  const target = to ? decodeB64Url(to) : null;

  // Validate: only allow http/https targets
  if (!target || !/^https?:\/\//i.test(target)) {
    return new NextResponse("Invalid redirect", { status: 400 });
  }

  try {
    await db
      .update(emails)
      .set({ clickedAt: new Date() })
      .where(and(eq(emails.id, emailId), isNull(emails.clickedAt)));
  } catch {
    // continue regardless
  }

  return NextResponse.redirect(target, 302);
}

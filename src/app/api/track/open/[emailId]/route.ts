import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

// 1×1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64"
);

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;
  // strip any extension (we expose .gif in URLs for filter-friendliness)
  const id = emailId.replace(/\.(gif|png)$/i, "");

  // Stamp opened_at only on first open
  try {
    await db
      .update(emails)
      .set({ openedAt: new Date() })
      .where(and(eq(emails.id, id), isNull(emails.openedAt)));
  } catch {
    // Always serve the pixel even if DB write fails
  }

  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      "Content-Length": String(PIXEL.length),
    },
  });
}

import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUserRow } from "./auth";

const TEST_ID = "user_test_123";

describe("ensureUserRow", () => {
  beforeEach(async () => {
    await db.delete(users).where(eq(users.id, TEST_ID));
  });

  it("inserts a new user row when one doesn't exist", async () => {
    await ensureUserRow({ clerkId: TEST_ID, email: "test@example.com" });

    const rows = await db.select().from(users).where(eq(users.id, TEST_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("test@example.com");
    expect(rows[0].postalAddress).toBeNull();
  });

  it("is idempotent — calling twice produces one row", async () => {
    await ensureUserRow({ clerkId: TEST_ID, email: "test@example.com" });
    await ensureUserRow({ clerkId: TEST_ID, email: "test@example.com" });

    const rows = await db.select().from(users).where(eq(users.id, TEST_ID));
    expect(rows).toHaveLength(1);
  });

  it("does NOT overwrite postal_address on a repeat call", async () => {
    await ensureUserRow({ clerkId: TEST_ID, email: "test@example.com" });
    await db
      .update(users)
      .set({ postalAddress: "123 Main St, San Francisco, CA 94102" })
      .where(eq(users.id, TEST_ID));

    await ensureUserRow({ clerkId: TEST_ID, email: "test@example.com" });

    const [row] = await db.select().from(users).where(eq(users.id, TEST_ID));
    expect(row.postalAddress).toBe("123 Main St, San Francisco, CA 94102");
  });
});

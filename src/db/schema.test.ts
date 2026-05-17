import { describe, it, expect } from "vitest";
import { db } from "./index";
import {
  users,
  emailAccounts,
  campaigns,
  sequenceSteps,
  leads,
  companyResearch,
  leadResearch,
  emails,
  replies,
  suppressionList,
  usageLog,
} from "./schema";

describe("schema", () => {
  it("each table accepts a basic select query (relation exists, columns match)", async () => {
    // We don't assert emptiness — other tests seed fixtures into this DB —
    // we only verify the relation exists and the column projection is valid.
    expect(Array.isArray(await db.select().from(users).limit(1))).toBe(true);
    expect(Array.isArray(await db.select().from(emailAccounts).limit(1))).toBe(
      true
    );
    expect(Array.isArray(await db.select().from(campaigns).limit(1))).toBe(true);
    expect(Array.isArray(await db.select().from(sequenceSteps).limit(1))).toBe(
      true
    );
    expect(Array.isArray(await db.select().from(leads).limit(1))).toBe(true);
    expect(
      Array.isArray(await db.select().from(companyResearch).limit(1))
    ).toBe(true);
    expect(Array.isArray(await db.select().from(leadResearch).limit(1))).toBe(
      true
    );
    expect(Array.isArray(await db.select().from(emails).limit(1))).toBe(true);
    expect(Array.isArray(await db.select().from(replies).limit(1))).toBe(true);
    expect(
      Array.isArray(await db.select().from(suppressionList).limit(1))
    ).toBe(true);
    expect(Array.isArray(await db.select().from(usageLog).limit(1))).toBe(true);
  });
});

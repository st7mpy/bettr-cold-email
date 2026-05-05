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
} from "./schema";

describe("schema", () => {
  it("each table is queryable (returns empty array on fresh DB)", async () => {
    expect(await db.select().from(users).limit(1)).toEqual([]);
    expect(await db.select().from(emailAccounts).limit(1)).toEqual([]);
    expect(await db.select().from(campaigns).limit(1)).toEqual([]);
    expect(await db.select().from(sequenceSteps).limit(1)).toEqual([]);
    expect(await db.select().from(leads).limit(1)).toEqual([]);
    expect(await db.select().from(companyResearch).limit(1)).toEqual([]);
    expect(await db.select().from(leadResearch).limit(1)).toEqual([]);
    expect(await db.select().from(emails).limit(1)).toEqual([]);
    expect(await db.select().from(replies).limit(1)).toEqual([]);
    expect(await db.select().from(suppressionList).limit(1)).toEqual([]);
  });
});

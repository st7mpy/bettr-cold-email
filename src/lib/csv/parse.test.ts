import { describe, it, expect } from "vitest";
import { parseCsv, MAX_ROWS } from "./parse";

describe("parseCsv", () => {
  it("parses standard headers in expected order", () => {
    const csv = `email,name,company,title
jane@acme.com,Jane Doe,Acme,VP Eng
john@beta.com,John Roe,Beta,CTO`;
    const out = parseCsv(csv);
    expect(out.leads).toHaveLength(2);
    expect(out.rejected).toHaveLength(0);
    expect(out.leads[0]).toMatchObject({
      email: "jane@acme.com",
      name: "Jane Doe",
      company: "Acme",
      title: "VP Eng",
    });
  });

  it("handles header casing and order variants", () => {
    const csv = `Company,Email Address,Role,Full Name
Acme,jane@acme.com,VP Eng,Jane Doe`;
    const out = parseCsv(csv);
    expect(out.leads[0]).toMatchObject({
      email: "jane@acme.com",
      name: "Jane Doe",
      company: "Acme",
      title: "VP Eng",
    });
  });

  it("combines first name + last name into name", () => {
    const csv = `email,first name,last name,company
jane@acme.com,Jane,Doe,Acme`;
    const out = parseCsv(csv);
    expect(out.leads[0].name).toBe("Jane Doe");
  });

  it("rejects rows missing email and reports the row number (1-indexed including header)", () => {
    const csv = `email,name
,Jane Doe
john@beta.com,John Roe`;
    const out = parseCsv(csv);
    expect(out.leads).toHaveLength(1);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0].row).toBe(2); // CSV row 2 = first data row
  });

  it("rejects rows with malformed email", () => {
    const csv = `email,name
not-an-email,Jane Doe
ok@valid.com,John Roe`;
    const out = parseCsv(csv);
    expect(out.leads).toHaveLength(1);
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0].reason).toMatch(/invalid/);
  });

  it("flows unknown columns into customFields", () => {
    const csv = `email,industry,arr
jane@acme.com,fintech,$50M`;
    const out = parseCsv(csv);
    expect(out.leads[0].customFields).toEqual({
      industry: "fintech",
      arr: "$50M",
    });
  });

  it("throws when CSV exceeds MAX_ROWS", () => {
    const header = "email\n";
    const rows = Array.from(
      { length: MAX_ROWS + 1 },
      (_, i) => `user${i}@x.com`
    ).join("\n");
    expect(() => parseCsv(header + rows)).toThrow(/exceeds/);
  });

  it("trims whitespace around values", () => {
    const csv = `email,name
  jane@acme.com  ,  Jane Doe  `;
    const out = parseCsv(csv);
    expect(out.leads[0].email).toBe("jane@acme.com");
    expect(out.leads[0].name).toBe("Jane Doe");
  });
});

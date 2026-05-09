import Papa from "papaparse";

export const MAX_ROWS = 5_000;

export interface ParsedLead {
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  customFields: Record<string, string>;
}

export interface ParseResult {
  leads: ParsedLead[];
  rejected: { row: number; reason: string }[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MappedField =
  | "email"
  | "name"
  | "first"
  | "last"
  | "company"
  | "title"
  | "notes";

const HEADER_MAP: Record<string, MappedField> = {
  email: "email",
  "email address": "email",
  "e-mail": "email",
  name: "name",
  "full name": "name",
  "first name": "first",
  firstname: "first",
  "last name": "last",
  lastname: "last",
  surname: "last",
  company: "company",
  organization: "company",
  org: "company",
  "company name": "company",
  title: "title",
  role: "title",
  "job title": "title",
  position: "title",
  notes: "notes",
  context: "notes",
};

function normalize(h: string): string {
  return h.trim().toLowerCase();
}

export function parseCsv(input: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.data.length > MAX_ROWS) {
    throw new Error(
      `CSV exceeds ${MAX_ROWS} rows (got ${parsed.data.length})`
    );
  }

  const leads: ParsedLead[] = [];
  const rejected: { row: number; reason: string }[] = [];

  parsed.data.forEach((row, i) => {
    const lead: ParsedLead = {
      email: "",
      name: null,
      company: null,
      title: null,
      notes: null,
      customFields: {},
    };
    let firstName = "";
    let lastName = "";

    for (const [key, rawValue] of Object.entries(row)) {
      const value = (rawValue ?? "").trim();
      const mapped = HEADER_MAP[normalize(key)];

      if (mapped === "email") {
        lead.email = value;
      } else if (mapped === "name") {
        lead.name = value || null;
      } else if (mapped === "first") {
        firstName = value;
      } else if (mapped === "last") {
        lastName = value;
      } else if (mapped === "company") {
        lead.company = value || null;
      } else if (mapped === "title") {
        lead.title = value || null;
      } else if (mapped === "notes") {
        lead.notes = value || null;
      } else if (key && value) {
        lead.customFields[key] = value;
      }
    }

    if (!lead.name && (firstName || lastName)) {
      lead.name = `${firstName} ${lastName}`.trim();
    }

    const rowNumber = i + 2; // header is row 1
    if (!lead.email) {
      rejected.push({ row: rowNumber, reason: "missing email" });
      return;
    }
    if (!EMAIL_RE.test(lead.email)) {
      rejected.push({ row: rowNumber, reason: "invalid email format" });
      return;
    }
    leads.push(lead);
  });

  return { leads, rejected };
}

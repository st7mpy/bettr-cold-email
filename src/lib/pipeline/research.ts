import {
  tavilySearch,
  tavilyExtract,
  type TavilyResult,
} from "@/lib/search/tavily";

export interface LeadInput {
  name: string;
  company: string;
  title?: string;
  /** If the user provided a LinkedIn URL on import, we extract directly from it. */
  linkedinUrl?: string | null;
  /** Same for an X / Twitter URL. */
  xUrl?: string | null;
}

export interface ResearchOutput {
  rawSearchResults: TavilyResult[];
  fetchedPages: { url: string; content: string }[];
}

const PERSON_QUERIES = (lead: LeadInput): string[] => [
  `"${lead.name}" "${lead.company}"`,
  `"${lead.name}" site:linkedin.com/in/`,
  `"${lead.name}" site:twitter.com OR site:x.com OR site:bsky.app`,
  `"${lead.name}" interview OR podcast OR talk OR keynote`,
  `"${lead.name}" blog OR essay OR wrote`,
];

const COMPANY_QUERIES = (lead: LeadInput): string[] => [
  `"${lead.company}" funding OR raised OR announced`,
  `"${lead.company}" launched OR shipped OR released`,
  `"${lead.company}" hiring`,
];

const TOP_K_TO_EXTRACT = 2;

function isUrl(s: string | null | undefined): s is string {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function runResearch(lead: LeadInput): Promise<ResearchOutput> {
  // 1. Operator-supplied URLs always go first — they are the highest-signal
  //    source we can get. We extract directly without burning a search query.
  const operatorUrls: string[] = [];
  if (isUrl(lead.linkedinUrl)) operatorUrls.push(lead.linkedinUrl);
  if (isUrl(lead.xUrl)) operatorUrls.push(lead.xUrl);

  const personHits: TavilyResult[] = [];
  for (const q of PERSON_QUERIES(lead)) {
    const results = await tavilySearch({ query: q, maxResults: 3 });
    if (results.length > 0) personHits.push(results[0]);
  }

  const chosen: TavilyResult[] = [...personHits];
  if (chosen.length === 0) {
    for (const q of COMPANY_QUERIES(lead)) {
      const results = await tavilySearch({ query: q, maxResults: 3 });
      if (results.length > 0) chosen.push(results[0]);
    }
  }

  // Extract the operator URLs PLUS the top hits (deduped). Operator URLs are
  // first in the list so they always make it into the fetched pages.
  const extractTargets = [
    ...operatorUrls,
    ...chosen.slice(0, TOP_K_TO_EXTRACT).map((r) => r.url),
  ];
  const dedupedUrls = Array.from(new Set(extractTargets));
  const fetchedPages =
    dedupedUrls.length === 0 ? [] : await tavilyExtract(dedupedUrls);

  // Surface operator URLs in rawSearchResults too so they show up in the lead
  // trace UI alongside search-discovered sources.
  const operatorAsHits: TavilyResult[] = operatorUrls.map((url) => ({
    url,
    title: url.includes("linkedin")
      ? "LinkedIn profile (operator-provided)"
      : "X / Twitter profile (operator-provided)",
    content: "",
  }));

  return {
    rawSearchResults: [...operatorAsHits, ...chosen],
    fetchedPages,
  };
}

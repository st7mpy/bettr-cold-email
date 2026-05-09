import {
  tavilySearch,
  tavilyExtract,
  type TavilyResult,
} from "@/lib/search/tavily";

export interface LeadInput {
  name: string;
  company: string;
  title?: string;
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

export async function runResearch(lead: LeadInput): Promise<ResearchOutput> {
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

  const urlsToExtract = chosen.slice(0, TOP_K_TO_EXTRACT).map((r) => r.url);
  const fetchedPages =
    urlsToExtract.length === 0 ? [] : await tavilyExtract(urlsToExtract);

  return {
    rawSearchResults: chosen,
    fetchedPages,
  };
}

const SEARCH_URL = "https://api.tavily.com/search";
const EXTRACT_URL = "https://api.tavily.com/extract";

export interface TavilyResult {
  url: string;
  title: string;
  content: string;
}

export interface TavilyExtracted {
  url: string;
  content: string;
}

function key(): string {
  const k = process.env.TAVILY_API_KEY;
  if (!k) throw new Error("TAVILY_API_KEY is not set");
  return k;
}

export async function tavilySearch(args: {
  query: string;
  maxResults?: number;
}): Promise<TavilyResult[]> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key(),
      query: args.query,
      max_results: args.maxResults ?? 5,
      search_depth: "basic",
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily search ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { results: TavilyResult[] };
  return json.results;
}

export async function tavilyExtract(
  urls: string[]
): Promise<TavilyExtracted[]> {
  if (urls.length === 0) return [];
  const res = await fetch(EXTRACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key(), urls }),
  });
  if (!res.ok) {
    throw new Error(`Tavily extract ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    results: { url: string; raw_content: string }[];
  };
  return json.results.map((r) => ({ url: r.url, content: r.raw_content }));
}

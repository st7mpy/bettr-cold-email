import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSearch = vi.fn();
const mockExtract = vi.fn();
vi.mock("@/lib/search/tavily", () => ({
  tavilySearch: mockSearch,
  tavilyExtract: mockExtract,
}));

const { runResearch } = await import("./research");

beforeEach(() => {
  mockSearch.mockReset();
  mockExtract.mockReset();
});

describe("runResearch", () => {
  it("runs the person-first query plan and extracts top 2 person hits", async () => {
    mockSearch
      .mockResolvedValueOnce([
        // "name" "company"
        {
          url: "https://blog.example/post",
          title: "Jane on X",
          content: "...",
        },
      ])
      .mockResolvedValueOnce([
        // site:linkedin.com/in/
        { url: "https://linkedin.com/in/jane", title: "Jane", content: "..." },
      ])
      .mockResolvedValueOnce([]) // twitter
      .mockResolvedValueOnce([]) // interview/podcast
      .mockResolvedValueOnce([]); // blog/essay

    mockExtract.mockResolvedValueOnce([
      { url: "https://blog.example/post", content: "FULL POST" },
      { url: "https://linkedin.com/in/jane", content: "FULL LI" },
    ]);

    const out = await runResearch({
      name: "Jane Doe",
      company: "Acme",
      title: "VP Eng",
    });
    expect(out.rawSearchResults).toHaveLength(2);
    expect(out.fetchedPages).toHaveLength(2);
    expect(mockSearch).toHaveBeenCalledTimes(5);
    expect(mockExtract).toHaveBeenCalledOnce();
  });

  it("falls back to company queries when person queries return nothing", async () => {
    for (let i = 0; i < 5; i++) mockSearch.mockResolvedValueOnce([]);
    mockSearch
      .mockResolvedValueOnce([
        {
          url: "https://news.example/funding",
          title: "Series B",
          content: "...",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockExtract.mockResolvedValueOnce([
      { url: "https://news.example/funding", content: "$50M raised" },
    ]);

    const out = await runResearch({
      name: "Jane Doe",
      company: "Acme",
      title: "VP Eng",
    });
    expect(mockSearch).toHaveBeenCalledTimes(8);
    expect(out.rawSearchResults[0].url).toContain("news.example");
  });

  it("returns empty result with no extract call when both person and company queries are empty", async () => {
    for (let i = 0; i < 8; i++) mockSearch.mockResolvedValueOnce([]);
    const out = await runResearch({
      name: "Ghost Person",
      company: "ObscureCo",
      title: "Engineer",
    });
    expect(out.rawSearchResults).toHaveLength(0);
    expect(out.fetchedPages).toHaveLength(0);
    expect(mockExtract).not.toHaveBeenCalled();
  });
});

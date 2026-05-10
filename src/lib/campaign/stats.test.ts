import { describe, it, expect } from "vitest";
import { computeCampaignStats } from "./stats";

const base = {
  id: "e1",
  openedAt: null,
  clickedAt: null,
  repliedAt: null,
  bouncedAt: null,
  status: "sent" as const,
};

describe("computeCampaignStats", () => {
  it("returns zeros when no emails", () => {
    const s = computeCampaignStats([]);
    expect(s).toEqual({
      sent: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      bounceRate: 0,
    });
  });

  it("counts sent emails and computes open rate", () => {
    const emails = [
      { ...base, id: "e1" },
      { ...base, id: "e2", openedAt: new Date() },
      { ...base, id: "e3", openedAt: new Date() },
    ];
    const s = computeCampaignStats(emails);
    expect(s.sent).toBe(3);
    expect(s.opened).toBe(2);
    expect(s.openRate).toBeCloseTo(67, 0);
  });

  it("computes click, reply and bounce rates", () => {
    const emails = [
      { ...base, id: "e1", openedAt: new Date(), clickedAt: new Date() },
      { ...base, id: "e2", repliedAt: new Date() },
      { ...base, id: "e3", status: "bounced" as const, bouncedAt: new Date() },
      { ...base, id: "e4" },
    ];
    const s = computeCampaignStats(emails);
    expect(s.clicked).toBe(1);
    expect(s.replied).toBe(1);
    expect(s.bounced).toBe(1);
    expect(s.clickRate).toBeCloseTo(25, 0);
    expect(s.replyRate).toBeCloseTo(25, 0);
    expect(s.bounceRate).toBeCloseTo(25, 0);
  });

  it("excludes queued emails from sent count", () => {
    const emails = [
      { ...base, id: "e1", status: "queued" as const },
      { ...base, id: "e2" },
    ];
    const s = computeCampaignStats(emails);
    expect(s.sent).toBe(1);
  });
});

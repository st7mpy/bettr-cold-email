export interface EmailRow {
  status: string;
  openedAt: Date | null;
  clickedAt: Date | null;
  repliedAt: Date | null;
  bouncedAt: Date | null;
}

export interface CampaignStats {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;  // % of sent
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

export function computeCampaignStats(emails: EmailRow[]): CampaignStats {
  const sent = emails.filter(
    (e) => e.status === "sent" || e.status === "bounced"
  ).length;
  const opened = emails.filter((e) => e.openedAt != null).length;
  const clicked = emails.filter((e) => e.clickedAt != null).length;
  const replied = emails.filter((e) => e.repliedAt != null).length;
  const bounced = emails.filter((e) => e.bouncedAt != null).length;

  return {
    sent,
    opened,
    clicked,
    replied,
    bounced,
    openRate: pct(opened, sent),
    clickRate: pct(clicked, sent),
    replyRate: pct(replied, sent),
    bounceRate: pct(bounced, sent),
  };
}

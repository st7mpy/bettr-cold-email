/**
 * Bettr Cold Email — "Dossier" design primitives
 * All components use inline CSS custom property refs matching globals.css tokens.
 * Do NOT convert these to Tailwind classes — the design system uses direct vars.
 */

import React from "react";

/* =========================================================
   Icon — 1.5px stroke geometric line icons
   ========================================================= */
type IconName =
  | "campaigns" | "inbox" | "shield" | "settings" | "plus"
  | "arrow-right" | "arrow-left" | "search" | "check" | "x"
  | "external" | "google" | "clock" | "spark" | "doc"
  | "link" | "upload" | "sun" | "moon" | "chevron-right"
  | "mail" | "stop";

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 16, stroke = 1.5, className, style }: IconProps) {
  const s: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style,
    "aria-hidden": true,
  };

  switch (name) {
    case "campaigns":
      return <svg {...s}><path d="M4 5h16M4 12h16M4 19h10"/></svg>;
    case "inbox":
      return <svg {...s}><path d="M3 12l3-7h12l3 7v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/><path d="M3 12h5l1 2h6l1-2h5"/></svg>;
    case "shield":
      return <svg {...s}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3Z"/></svg>;
    case "settings":
      return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg>;
    case "plus":
      return <svg {...s}><path d="M12 5v14M5 12h14"/></svg>;
    case "arrow-right":
      return <svg {...s}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "arrow-left":
      return <svg {...s}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>;
    case "search":
      return <svg {...s}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "check":
      return <svg {...s}><path d="m5 13 4 4L19 7"/></svg>;
    case "x":
      return <svg {...s}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "external":
      return <svg {...s}><path d="M14 5h5v5M19 5l-9 9M19 14v5H5V5h5"/></svg>;
    case "google":
      return (
        <svg {...s} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.2 3-7.4Z"/>
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z" opacity=".5"/>
          <path d="M6.4 14.1a6 6 0 0 1 0-3.8V7.7H3.1a10 10 0 0 0 0 9l3.3-2.6Z" opacity=".3"/>
          <path d="M12 6.4a5.4 5.4 0 0 1 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.7l3.3 2.6a5.9 5.9 0 0 1 5.6-4Z" opacity=".7"/>
        </svg>
      );
    case "clock":
      return <svg {...s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "spark":
      return <svg {...s}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg>;
    case "doc":
      return <svg {...s}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>;
    case "link":
      return <svg {...s}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"/></svg>;
    case "upload":
      return <svg {...s}><path d="M12 16V4M5 11l7-7 7 7M4 20h16"/></svg>;
    case "sun":
      return <svg {...s}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case "moon":
      return <svg {...s}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>;
    case "chevron-right":
      return <svg {...s}><path d="M9 18l6-6-6-6"/></svg>;
    case "mail":
      return <svg {...s}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>;
    case "stop":
      return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
    default:
      return null;
  }
}

/* =========================================================
   Pill — status badge
   ========================================================= */
type PillTone = "default" | "good" | "warn" | "accent" | "bad";

interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Pill({ tone = "default", dot, children, style }: PillProps) {
  const toneClass: Record<PillTone, string> = {
    default: "pill",
    good:    "pill pill-good",
    warn:    "pill pill-warn",
    accent:  "pill pill-accent",
    bad:     "pill pill-bad",
  };
  return (
    <span className={toneClass[tone]} style={style}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/* =========================================================
   Btn — styled button
   ========================================================= */
type BtnVariant = "primary" | "accent" | "outline" | "ghost";

interface BtnProps {
  variant?: BtnVariant;
  size?: "sm" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function Btn({
  variant = "outline",
  size,
  children,
  onClick,
  type = "button",
  icon,
  iconRight,
  disabled,
  style,
  className,
}: BtnProps) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    size === "lg" ? "btn-lg" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} style={style}>
      {icon && <Icon name={icon} size={15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} />}
    </button>
  );
}

/* =========================================================
   SectionLabel — §01 editorial divider
   ========================================================= */
interface SectionLabelProps {
  children: React.ReactNode;
  num?: number;
}

export function SectionLabel({ children, num }: SectionLabelProps) {
  return (
    <div
      className="section-num"
      style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}
    >
      {num != null && (
        <span style={{ color: "var(--accent)" }}>
          § {String(num).padStart(2, "0")}
        </span>
      )}
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
    </div>
  );
}

/* =========================================================
   Stat — oversize editorial numeric tile
   ========================================================= */
interface StatProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  suffix?: string;
  noBorderRight?: boolean;
}

export function Stat({ label, value, sub, accent, suffix, noBorderRight }: StatProps) {
  return (
    <div
      style={{
        padding: "22px 24px",
        borderRight: noBorderRight ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        className="display tnum"
        style={{
          fontSize: 46,
          marginTop: 10,
          color: accent ? "var(--accent)" : "var(--ink)",
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 18, marginLeft: 4, color: "var(--muted)" }}>
            {suffix}
          </span>
        )}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   StatusDot — colored lead status indicator
   ========================================================= */
type LeadStatus =
  | "replied" | "sent" | "researching" | "no_signal" | "needs_review"
  | "queued" | "positive" | "negative" | "question" | "out_of_office"
  | "unsubscribe" | "stopped" | "bounced" | "drafted";

interface StatusDotProps {
  status: LeadStatus | string;
}

export function StatusDot({ status }: StatusDotProps) {
  const map: Record<string, string> = {
    replied:      "var(--good)",
    positive:     "var(--good)",
    sent:         "var(--info)",
    researching:  "var(--warn)",
    needs_review: "var(--warn)",
    question:     "var(--warn)",
    out_of_office:"var(--info)",
    no_signal:    "var(--muted)",
    queued:       "var(--muted)",
    unsubscribe:  "var(--muted)",
    stopped:      "var(--muted)",
    negative:     "var(--bad)",
    bounced:      "var(--bad)",
    drafted:      "var(--hairline)",
  };
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: map[status] ?? "var(--muted)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

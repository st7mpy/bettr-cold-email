"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/design";

const navItems = [
  { href: "/dashboard",            label: "Campaigns",   icon: "campaigns" as const, badge: null, exact: true },
  { href: "/dashboard/inbox",      label: "Reply inbox", icon: "inbox"     as const, badge: 4,    exact: false },
  { href: "/dashboard/suppression",label: "Suppression", icon: "shield"    as const, badge: null, exact: false },
  { href: "/dashboard/settings",   label: "Settings",    icon: "settings"  as const, badge: null, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href || pathname.startsWith("/dashboard/campaigns");
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{
        borderRight: "1px solid var(--hairline)",
        background: "var(--paper-2)",
        padding: "22px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
        width: 224,
        flexShrink: 0,
      }}
    >
      {/* Logo / wordmark */}
      <Link
        href="/"
        style={{
          textAlign: "left",
          padding: "4px 10px 18px",
          borderBottom: "1px solid var(--hairline)",
          marginBottom: 14,
          display: "block",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Relay
        </div>
        <div
          className="display"
          style={{ fontSize: 22, marginTop: 4, lineHeight: 1 }}
        >
          Bettr
          <br />
          Cold Email
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginTop: 6,
          }}
        >
          v 0.4
        </div>
      </Link>

      {/* Nav items */}
      {navItems.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 4,
              color: active ? "var(--ink)" : "var(--muted)",
              background: active ? "var(--surface)" : "transparent",
              border: active ? "1px solid var(--hairline)" : "1px solid transparent",
              textAlign: "left",
              fontSize: 13.5,
              fontWeight: active ? 500 : 400,
              textDecoration: "none",
              transition: "background 120ms, color 120ms",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                (e.currentTarget as HTMLElement).style.color = "var(--ink)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--muted)";
              }
            }}
          >
            <Icon name={item.icon} size={15} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge != null && (
              <span
                className="mono"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 999,
                  fontWeight: 500,
                }}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Daily quota */}
      <div
        style={{
          padding: "12px 10px",
          borderTop: "1px solid var(--hairline)",
          marginTop: 12,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          Quota · today
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            marginTop: 4,
          }}
        >
          <span className="tnum" style={{ fontSize: 18, fontWeight: 500 }}>
            142
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            / 350
          </span>
        </div>
        <div
          style={{
            height: 3,
            background: "var(--hairline)",
            marginTop: 6,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "40%",
              background: "var(--ink)",
            }}
          />
        </div>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Campaigns", exact: true },
  { href: "/dashboard/inbox", label: "Reply inbox", exact: false },
  { href: "/dashboard/suppression", label: "Suppression", exact: false },
  { href: "/dashboard/settings", label: "Settings", exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/40 p-4 flex flex-col">
      <div className="mb-6 text-lg font-semibold">Bettr Cold Email</div>
      <nav className="flex flex-col gap-1 text-sm">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 transition-colors ${
              isActive(item.href, item.exact)
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 text-xs text-muted-foreground">
        Bettr Cold Email · v0.4
      </div>
    </aside>
  );
}

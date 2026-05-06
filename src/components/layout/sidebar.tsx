import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Campaigns" },
  { href: "/dashboard/inbox", label: "Reply inbox" },
  { href: "/dashboard/suppression", label: "Suppression" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/40 p-4">
      <div className="mb-6 text-lg font-semibold">Bettr Cold Email</div>
      <nav className="flex flex-col gap-1 text-sm">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

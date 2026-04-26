import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/events", label: "Events" },
  { href: "/transactions", label: "Transactions" },
  { href: "/categories", label: "Categories" },
  { href: "/import", label: "Import" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

interface AppNavProps {
  email?: string | null;
  version?: string;
}

export function AppNav({ email, version }: AppNavProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold">
            Cashflow
            {version && (
              <sup className="ml-1 text-xs font-normal text-muted-foreground/70">v{version}</sup>
            )}
          </Link>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {email && (
          <span className="text-sm text-muted-foreground">{email}</span>
        )}
      </div>
    </header>
  );
}

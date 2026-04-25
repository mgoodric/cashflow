import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/events", label: "Events" },
  { href: "/import", label: "Import" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/insights", label: "Insights" },
];

interface AppNavProps {
  email?: string | null;
  version?: string;
}

export function AppNav({ email, version }: AppNavProps) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold">
            Cashflow
            {version && (
              <sup className="ml-1 text-xs font-normal text-gray-400">v{version}</sup>
            )}
          </Link>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {email && (
          <span className="text-sm text-gray-500">{email}</span>
        )}
      </div>
    </header>
  );
}

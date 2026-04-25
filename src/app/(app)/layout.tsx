import Link from "next/link";
import { headers } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const email = headersList.get("x-email") ?? headersList.get("x-forwarded-email");

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/accounts", label: "Accounts" },
    { href: "/events", label: "Events" },
    { href: "/import", label: "Import" },
    { href: "/scenarios", label: "Scenarios" },
    { href: "/insights", label: "Insights" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold">
              Cashflow
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
      <main className="mx-auto max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}

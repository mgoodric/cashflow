import { headers } from "next/headers";
import { AppNav } from "@/components/nav/app-nav";
import packageJson from "../../../package.json";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const email = headersList.get("x-email") ?? headersList.get("x-forwarded-email");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav email={email} version={packageJson.version} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}

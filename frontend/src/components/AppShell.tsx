"use client";

import { usePathname } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";

const PUBLIC_PATHS = new Set(["/register"]);

/**
 * Wraps the app:
 * - `/register` — no auth gate (public signup)
 * - Otherwise — login required, then sidebar + main
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname != null && PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <Sidebar />
      <main className="min-h-screen pt-14 md:ml-64 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </AuthGate>
  );
}

"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { AuthUser, getAccessToken, getCurrentUser, refreshSession } from "@/lib/auth";

type ProtectedShellProps = {
  children: ReactNode | ((user: AuthUser) => ReactNode);
};

export function ProtectedShell({ children }: ProtectedShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const currentUser = getCurrentUser();
      const currentToken = getAccessToken();
      const sessionUser = currentUser && currentToken ? currentUser : await refreshSession();

      if (!sessionUser) {
        router.push("/login");
        return;
      }

      setUser(sessionUser);
      setIsReady(true);
    }

    loadSession();
  }, [router]);

  if (!isReady || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Chargement de la session...
      </main>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-[68px_minmax(0,1fr)] bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white lg:grid-cols-[270px_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <Header user={user} />
        <main className="px-3 py-4 sm:px-4 sm:py-5 lg:px-10 lg:py-8">
          {typeof children === "function" ? children(user) : children}
        </main>
      </div>
    </div>
  );
}

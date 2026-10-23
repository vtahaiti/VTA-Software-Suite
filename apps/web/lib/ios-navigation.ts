"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { resolveIosHref } from "@/lib/ios-route-map";

export function useIosRouteParams<T extends Record<string, string> = { id: string }>() {
  const search = useSearchParams();
  return Object.fromEntries(search.entries()) as T;
}

export function useIosRouter() {
  const router = useRouter();
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(resolveIosHref(href), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(resolveIosHref(href), options)
  }), [router]);
}

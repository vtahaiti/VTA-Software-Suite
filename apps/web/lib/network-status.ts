"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api-url";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      if (!navigator.onLine) {
        if (isMounted) {
          setIsOnline(false);
          setLastCheckedAt(new Date());
        }
        return;
      }

      try {
        const response = await fetchApi("/health", { cache: "no-store" });
        if (isMounted) setIsOnline(response.ok);
      } catch {
        if (isMounted) setIsOnline(false);
      } finally {
        if (isMounted) setLastCheckedAt(new Date());
      }
    }

    const onOnline = () => void check();
    const onOffline = () => {
      setIsOnline(false);
      setLastCheckedAt(new Date());
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void check();
    const timer = window.setInterval(check, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
    };
  }, []);

  return { isOnline, lastCheckedAt };
}

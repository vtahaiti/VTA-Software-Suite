"use client";

import { useEffect, useState } from "react";

export function useNativeRuntime() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    let active = true;

    async function detectNativeRuntime() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (active) setIsNative(Capacitor.isNativePlatform());
      } catch {
        if (active) setIsNative(false);
      }
    }

    void detectNativeRuntime();
    return () => {
      active = false;
    };
  }, []);

  return isNative;
}

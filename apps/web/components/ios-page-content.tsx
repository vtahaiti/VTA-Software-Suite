"use client";

import { ReactNode, useEffect, useRef } from "react";

// Preserve the existing table data and actions, but give each mobile field its
// column label. Observe new rows too (search, pagination and async loading).
export function labelIosTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>("table").forEach(table => {
    const headers = Array.from(table.querySelectorAll("thead tr:last-child th"));
    if (!headers.length || table.querySelector("[rowspan], th[colspan]")) return;
    table.dataset.iosCards = "true";
    table.querySelectorAll("tbody tr").forEach(row => {
      Array.from(row.children).forEach((cell, index) => {
        if (cell.tagName === "TD" && !cell.hasAttribute("colspan")) {
          cell.setAttribute("data-column-label", headers[index]?.textContent?.trim() ?? "");
        }
      });
    });
  });
}

export function IosPageContent({ children, sale = false }: { children: ReactNode; sale?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || sale) return;
    labelIosTables(root);
    const observer = new MutationObserver(() => labelIosTables(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [sale]);
  return <main ref={ref} className={sale ? "ios-sale-content px-4 pb-24 pt-4" : "ios-page-content"}>{children}</main>;
}

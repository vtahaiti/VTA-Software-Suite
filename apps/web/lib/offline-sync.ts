"use client";

import { getAccessToken } from "@/lib/auth";
import { getPendingOfflineSales, updateOfflineSale } from "@/lib/offline-db";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type SyncResult = {
  localId: string;
  status: "SYNCED" | "CONFLICT" | "ERROR";
  saleId?: string;
  message?: string;
};

export async function syncOfflineSalesNow() {
  const token = getAccessToken();
  if (!token) throw new Error("Session expirée. Connectez-vous avant de synchroniser.");

  const pendingSales = await getPendingOfflineSales();
  if (!pendingSales.length) return { synced: 0, conflicts: 0, errors: 0 };

  const response = await fetch(`${apiUrl}/pos/sync-offline-sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      sales: pendingSales.map((sale) => ({
        localId: sale.localId,
        createdOfflineAt: sale.createdOfflineAt,
        ...sale.payload
      }))
    })
  });

  if (!response.ok) throw new Error("Synchronisation impossible pour le moment.");

  const body = (await response.json()) as { results: SyncResult[] };
  let synced = 0;
  let conflicts = 0;
  let errors = 0;

  for (const result of body.results) {
    if (result.status === "SYNCED") {
      synced += 1;
      await updateOfflineSale(result.localId, { status: "SYNCED", saleId: result.saleId, message: "Synchronisée" });
    } else if (result.status === "CONFLICT") {
      conflicts += 1;
      await updateOfflineSale(result.localId, { status: "CONFLICT", message: result.message ?? "Conflit à vérifier" });
    } else {
      errors += 1;
      await updateOfflineSale(result.localId, { status: "ERROR", message: result.message ?? "Erreur de synchronisation" });
    }
  }

  return { synced, conflicts, errors };
}

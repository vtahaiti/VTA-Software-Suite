import { fetchWithAuth } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-url";
import { getCurrentUser } from "@/lib/auth";
import { saveOfflineProducts, type OfflineProduct } from "@/lib/offline-db";

export async function prepareOfflineCatalog(warehouseId: string, signal?: AbortSignal) {
  const owner = getCurrentUser();
  let total = Infinity;
  const products: OfflineProduct[] = [];
  for (let page = 1; products.length < total; page += 1) {
    const response = await fetchWithAuth(apiUrl(`/pos/products?warehouseId=${encodeURIComponent(warehouseId)}&page=${page}&limit=100`), { signal });
    if (!response.ok) throw new Error("Préparation hors ligne impossible. Réessayez avec Internet.");
    const body = await response.json() as { items: OfflineProduct[]; meta?: { total?: number } };
    if (!body.items?.length) break;
    products.push(...body.items);
    total = body.meta?.total ?? products.length;
  }
  const current = getCurrentUser();
  if (signal?.aborted || current?.id !== owner?.id || current?.tenantId !== owner?.tenantId) return;
  await saveOfflineProducts(products, warehouseId);
  return products.length;
}

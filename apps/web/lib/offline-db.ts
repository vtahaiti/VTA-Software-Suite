"use client";
import { getCurrentUser } from "@/lib/auth";

export type OfflineProduct = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  availableStock: number;
  stockTracked?: boolean;
  primaryBarcode?: string | null;
  category?: string | null;
};

export type OfflineCustomer = {
  id: string;
  displayName?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
};

export type OfflineStore = { id: string; name: string; code: string };
export type OfflineWarehouse = { id: string; name: string; code: string; storeId?: string | null };
export type OfflineCashSession = { id: string; status: string; cashRegister?: { name: string } };

export type OfflinePosContext = {
  stores: OfflineStore[];
  warehouses: OfflineWarehouse[];
  sessions: OfflineCashSession[];
  customers: OfflineCustomer[];
  savedAt: string;
};

export type OfflineSaleStatus = "PENDING" | "SYNCED" | "CONFLICT" | "ERROR";

export type OfflineSale = {
  localId: string;
  status: OfflineSaleStatus;
  createdOfflineAt: string;
  payload: {
    customerId?: string;
    storeId?: string;
    warehouseId: string;
    cashSessionId?: string;
    taxRate?: number;
    discount?: number;
    items: Array<{ productId?: string | null; customId?: string; customName?: string; customType?: string; customNote?: string; unitPrice?: number; quantity: number; discount?: number }>;
    payments: Array<{ method: string; amount: number; reference?: string }>;
  };
  total: number;
  receiptHtml?: string;
  receiptWidth?: "58" | "72" | "80";
  message?: string;
  saleId?: string;
};

const dbName = "vta-commerce-offline";
const dbVersion = 3;
const productsStore = "warehouseProducts";
const salesStore = "offlineSales";
const contextStore = "posContext";
const metadataStore = "metadata";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const user = getCurrentUser();
    if (!user?.tenantId || !user.id) { reject(new Error("Connexion requise pour les données locales.")); return; }
    const request = indexedDB.open(`${dbName}:${user.tenantId}:${user.id}`, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(productsStore)) db.createObjectStore(productsStore, { keyPath: "cacheKey" });
      if (!db.objectStoreNames.contains(salesStore)) db.createObjectStore(salesStore, { keyPath: "localId" });
      if (!db.objectStoreNames.contains(contextStore)) db.createObjectStore(contextStore, { keyPath: "id" });
      if (!db.objectStoreNames.contains(metadataStore)) db.createObjectStore(metadataStore, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    transaction.oncomplete = () => resolve((request as IDBRequest<T> | undefined)?.result as T);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
}

type CachedProduct = OfflineProduct & { cacheKey: string; warehouseId: string };
const productKey = (warehouseId: string, productId: string) => `${warehouseId}:${productId}`;

export async function saveOfflineProducts(products: OfflineProduct[], warehouseId: string) {
  if (!warehouseId) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([productsStore, salesStore], "readwrite");
    const pending = tx.objectStore(salesStore).getAll();
    pending.onsuccess = () => {
      const sales = pending.result as OfflineSale[];
      for (const product of products) {
        const reserved = sales.filter(sale => sale.status !== "SYNCED" && sale.payload.warehouseId === warehouseId)
          .flatMap(sale => sale.payload.items).filter(item => item.productId === product.id)
          .reduce((total, item) => total + item.quantity, 0);
        tx.objectStore(productsStore).put({ ...product, availableStock: Math.max(0, product.availableStock - reserved), warehouseId, cacheKey: productKey(warehouseId, product.id) });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  }).finally(() => db.close());
}

export async function getOfflineProducts(warehouseId?: string) {
  const products = await withStore<CachedProduct[]>(productsStore, "readonly", store => store.getAll());
  return warehouseId !== undefined ? products.filter(product => product.warehouseId === warehouseId) : products;
}

// Persist the sale and reserve its stock together, or persist neither.
export async function commitOfflineSale(sale: OfflineSale) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([productsStore, salesStore], "readwrite");
    let failure: Error | undefined;
    const abort = (message: string) => { failure = new Error(message); tx.abort(); };
    const existing = tx.objectStore(salesStore).get(sale.localId);
    existing.onsuccess = () => {
      if (existing.result) { abort("Cette vente locale existe déjà."); return; }
      const quantities = new Map<string, number>();
      for (const item of sale.payload.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) { abort("Quantité invalide."); return; }
        if (item.productId) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }
      for (const [id, quantity] of quantities) {
        const key = productKey(sale.payload.warehouseId, id);
        const request = tx.objectStore(productsStore).get(key);
        request.onsuccess = () => {
          const product = request.result as CachedProduct | undefined;
          if (!product) { abort("Produit indisponible hors ligne dans ce dépôt."); return; }
          if (product.stockTracked === false) return;
          if (product.availableStock < quantity) { abort("Stock local insuffisant."); return; }
          tx.objectStore(productsStore).put({ ...product, availableStock: product.availableStock - quantity });
        };
      }
      tx.objectStore(salesStore).put(sale);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error("Enregistrement local impossible."));
  }).finally(() => db.close());
}

export async function saveOfflinePosContext(context: Omit<OfflinePosContext, "savedAt">) {
  await withStore(contextStore, "readwrite", (store) => {
    store.put({ id: "default", ...context, savedAt: new Date().toISOString() });
  });
}

export async function getOfflinePosContext() {
  const context = await withStore<OfflinePosContext & { id: string } | undefined>(contextStore, "readonly", (store) => store.get("default"));
  return context ?? null;
}

export function saveOfflineSale(sale: OfflineSale) {
  return withStore(salesStore, "readwrite", (store) => store.put(sale));
}

export function getOfflineSales() {
  return withStore<OfflineSale[]>(salesStore, "readonly", (store) => store.getAll());
}

export async function getPendingOfflineSales() {
  const sales = await getOfflineSales();
  return sales.filter((sale) => sale.status === "PENDING" || sale.status === "ERROR" || sale.status === "CONFLICT");
}

export async function updateOfflineSale(localId: string, changes: Partial<OfflineSale>) {
  const sales = await getOfflineSales();
  const sale = sales.find((item) => item.localId === localId);
  if (!sale) return;
  await saveOfflineSale({ ...sale, ...changes });
}

export async function getOfflineSummary() {
  const [products, sales, context] = await Promise.all([getOfflineProducts(), getOfflineSales(), getOfflinePosContext()]);
  return {
    products: products.length,
    pendingSales: sales.filter((sale) => sale.status === "PENDING" || sale.status === "ERROR" || sale.status === "CONFLICT").length,
    syncedSales: sales.filter((sale) => sale.status === "SYNCED").length,
    customers: context?.customers.length ?? 0,
    lastSavedAt: context?.savedAt ?? null
  };
}

export function saveOfflineTaxRate(rate: number) {
  return withStore(metadataStore, "readwrite", store => store.put({ key: "taxRate", value: rate }));
}
export async function getOfflineTaxRate(): Promise<number | null> {
  const entry = await withStore<{ key: string; value: number } | undefined>(metadataStore, "readonly", store => store.get("taxRate"));
  return entry && Number.isFinite(entry.value) ? entry.value : null;
}

export type OfflineReceiptBranding = {
  companyName: string;
  logoSource: string | null;
  logoDataUrl: string | null;
  logoUnavailable: boolean;
};
export function saveOfflineReceiptBranding(branding: OfflineReceiptBranding) {
  return withStore(metadataStore, "readwrite", store => store.put({ key: "receiptBranding", value: branding }));
}
export async function getOfflineReceiptBranding(): Promise<OfflineReceiptBranding | null> {
  const record = await withStore<{ value: OfflineReceiptBranding } | undefined>(metadataStore, "readonly", store => store.get("receiptBranding"));
  return record?.value ?? null;
}

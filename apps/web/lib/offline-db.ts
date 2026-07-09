"use client";

export type OfflineProduct = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  availableStock: number;
  primaryBarcode?: string | null;
  category?: string | null;
};

export type OfflineSaleStatus = "PENDING" | "SYNCED" | "CONFLICT" | "ERROR";

export type OfflineSale = {
  localId: string;
  status: OfflineSaleStatus;
  createdOfflineAt: string;
  payload: {
    storeId?: string;
    warehouseId: string;
    cashSessionId?: string;
    taxRate?: number;
    discount?: number;
    items: Array<{ productId: string; quantity: number; discount?: number }>;
    payments: Array<{ method: string; amount: number; reference?: string }>;
  };
  total: number;
  message?: string;
  saleId?: string;
};

const dbName = "vta-commerce-offline";
const dbVersion = 1;
const productsStore = "products";
const salesStore = "offlineSales";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(productsStore)) db.createObjectStore(productsStore, { keyPath: "id" });
      if (!db.objectStoreNames.contains(salesStore)) db.createObjectStore(salesStore, { keyPath: "localId" });
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

export async function saveOfflineProducts(products: OfflineProduct[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(productsStore, "readwrite");
    const store = transaction.objectStore(productsStore);
    for (const product of products) store.put(product);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}

export function getOfflineProducts() {
  return withStore<OfflineProduct[]>(productsStore, "readonly", (store) => store.getAll());
}

export async function updateOfflineProductStock(productId: string, quantityDelta: number) {
  const products = await getOfflineProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  await withStore(productsStore, "readwrite", (store) => {
    store.put({ ...product, availableStock: Math.max(0, product.availableStock + quantityDelta) });
  });
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

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";
import { getOfflineProducts, getPendingOfflineSales, saveOfflineProducts, saveOfflineSale, updateOfflineProductStock } from "@/lib/offline-db";
import { syncOfflineSalesNow } from "@/lib/offline-sync";
import { useNetworkStatus } from "@/lib/network-status";
import { getTenantBusinessConfiguration, type TenantBusinessConfiguration } from "@/lib/business-profiles";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Product = { id: string; name: string; sku: string; salePrice: number; availableStock: number; primaryBarcode?: string | null; category?: string | null };
type Store = { id: string; name: string; code: string };
type Warehouse = { id: string; name: string; code: string; storeId?: string | null };
type CashSession = { id: string; status: string; cashRegister?: { name: string } };
type Customer = { id: string; displayName?: string | null; phone?: string | null; mobile?: string | null; whatsapp?: string | null };
type CartLine = { productId: string; sku: string; name: string; unitPrice: number; quantity: number; discount: number; tax: number; total: number; availableStock: number; hasEnoughStock: boolean };
type Cart = { items: CartLine[]; subtotal: number; itemDiscount: number; discount: number; tax: number; total: number; taxRate: number; canCheckout: boolean };
type SaleHistory = { id: string; total: string | number; createdAt: string; receipt?: { number: string } | null; invoice?: { documentNumber: string } | null };
type SaleResponse = { id: string; total: string | number; receipt?: { number: string; content: string } | null; invoice?: { documentNumber: string; total: string | number } | null };
type PaymentLine = { method: string; amount: string; reference: string };
type CustomerForm = { name: string; phone: string; address: string; email: string; notes: string };
type PosDraft = { cart: Cart; customerId: string; payments: PaymentLine[]; orderDiscount: string; taxRate: string; storeId: string; warehouseId: string; cashSessionId: string; updatedAt: string };

const emptyCart: Cart = { items: [], subtotal: 0, itemDiscount: 0, discount: 0, tax: 0, total: 0, taxRate: 0, canCheckout: false };
const emptyCustomerForm: CustomerForm = { name: "", phone: "", address: "", email: "", notes: "" };

export default function PosPage() {
  const { isOnline } = useNetworkStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [history, setHistory] = useState<SaleHistory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [storeId, setStoreId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [cashSessionId, setCashSessionId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [orderDiscount, setOrderDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [showExpertOptions, setShowExpertOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [pendingOfflineSales, setPendingOfflineSales] = useState(0);
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [business, setBusiness] = useState<TenantBusinessConfiguration | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomerForm);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${getAccessToken()}` }), []);
  const cartPayload = useCallback(() => ({
    storeId: storeId || undefined,
    warehouseId: warehouseId || undefined,
    taxRate: Number(taxRate || 0),
    discount: Number(orderDiscount || 0),
    items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity, discount: item.discount }))
  }), [cart.items, orderDiscount, storeId, taxRate, warehouseId]);

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ search: query, limit: "24" });
      if (warehouseId) params.set("warehouseId", warehouseId);
      const response = await fetch(`${apiUrl}/pos/products?${params.toString()}`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json() as { items: Product[] };
        setProducts(data.items ?? []);
        await saveOfflineProducts(data.items ?? []);
        return;
      }
      throw new Error("API indisponible");
    } catch {
      const cachedProducts = await getOfflineProducts();
      const normalizedQuery = query.trim().toLowerCase();
      setProducts(normalizedQuery ? cachedProducts.filter((product) => product.name.toLowerCase().includes(normalizedQuery) || product.sku.toLowerCase().includes(normalizedQuery) || product.primaryBarcode?.includes(normalizedQuery)) : cachedProducts);
    }
  }, [authHeaders, query, warehouseId]);

  const loadRefs = useCallback(async () => {
    const response = await fetch(`${apiUrl}/pos/context`, { headers: authHeaders() }).catch(() => null);
    if (!response?.ok) {
      setError("Impossible de charger le magasin, le depot et la caisse active.");
      return;
    }
    const data = await response.json() as { stores: Store[]; warehouses: Warehouse[]; sessions: CashSession[]; history: SaleHistory[]; customers: Customer[] };
    setStores(data.stores ?? []);
    setStoreId((current) => current || data.stores?.[0]?.id || "");
    setWarehouses(data.warehouses ?? []);
    setWarehouseId((current) => current || data.warehouses?.[0]?.id || "");
    const openSessions = (data.sessions ?? []).filter((session) => session.status === "OPEN");
    setSessions(openSessions);
    setCashSessionId((current) => current || openSessions[0]?.id || "");
    setHistory(data.history ?? []);
    setCustomers(data.customers ?? []);
  }, [authHeaders]);

  useEffect(() => { void loadRefs(); }, [loadRefs]);
  useEffect(() => { const token = getAccessToken(); if (token) void getCompanyBranding(token).then(setBranding).catch(() => undefined); void getTenantBusinessConfiguration().then(setBusiness).catch(() => undefined); }, []);
  useEffect(() => {
    const draft = loadPosDraft();
    if (!draft) return;
    setCart(draft.cart);
    setCustomerId(draft.customerId);
    setPayments(draft.payments.length ? draft.payments : [{ method: "CASH", amount: "", reference: "" }]);
    setOrderDiscount(draft.orderDiscount);
    setTaxRate(draft.taxRate);
    setStoreId((current) => current || draft.storeId);
    setWarehouseId((current) => current || draft.warehouseId);
    setCashSessionId((current) => current || draft.cashSessionId);
    setMessage("Vente en cours restaurée.");
  }, []);
  useEffect(() => {
    const hasDraft = cart.items.length > 0 || Boolean(customerId) || Number(orderDiscount || 0) > 0 || payments.some((payment) => Number(payment.amount || 0) > 0);
    if (!hasDraft) {
      clearPosDraft();
      return;
    }
    savePosDraft({ cart, customerId, payments, orderDiscount, taxRate, storeId, warehouseId, cashSessionId, updatedAt: new Date().toISOString() });
  }, [cart, customerId, payments, orderDiscount, taxRate, storeId, warehouseId, cashSessionId]);
  useEffect(() => { scanInputRef.current?.focus(); }, []);
  useEffect(() => { const timer = setTimeout(() => void loadProducts(), 200); return () => clearTimeout(timer); }, [loadProducts]);
  useEffect(() => { void refreshPendingCount(); }, []);
  useEffect(() => { if (isOnline) void synchronizeOfflineSales(false); }, [isOnline]);

  async function syncCart(endpoint: "add" | "update" | "remove" | "calculate", extra: Record<string, string | number> = {}) {
    setError("");
    const payload = { ...cartPayload(), ...extra };
    if (!isOnline) {
      setCart(calculateLocalCart(payload.items as Array<{ productId: string; quantity: number; discount?: number }>, products, Number(payload.taxRate ?? 0), Number(payload.discount ?? 0)));
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/pos/cart/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setCart(await response.json() as Cart);
    } catch {
      setCart(calculateLocalCart(payload.items as Array<{ productId: string; quantity: number; discount?: number }>, products, Number(payload.taxRate ?? 0), Number(payload.discount ?? 0)));
      setMessage("Mode hors ligne active. Le panier utilise le stock local.");
    }
  }

  async function addProduct(productId: string) {
    await syncCart("add", { productId, quantity: 1 });
  }

  async function updateQuantity(productId: string, quantity: number) {
    await syncCart("update", { productId, quantity: Math.max(0, quantity) });
  }

  async function removeProduct(productId: string) {
    await syncCart("remove", { productId });
  }

  function updatePayment(index: number, changes: Partial<PaymentLine>) {
    setPayments((current) => current.map((payment, paymentIndex) => (paymentIndex === index ? { ...payment, ...changes } : payment)));
  }

  function removePayment(index: number) {
    setPayments((current) => current.length === 1 ? [{ method: "CASH", amount: "", reference: "" }] : current.filter((_, paymentIndex) => paymentIndex !== index));
  }

  function setCashPayment(amount: string) {
    setPayments([{ method: "CASH", amount, reference: "" }]);
  }

  async function scanBarcode(value = barcode || query) {
    const term = value.trim();
    if (!term) return;
    setError("");
    const localProduct = products.find((product) => product.primaryBarcode === term || product.sku.toLowerCase() === term.toLowerCase() || product.name.toLowerCase().includes(term.toLowerCase()));
    if (!isOnline && localProduct) {
      await addProduct(localProduct.id);
      setBarcode("");
      setQuery("");
      setMessage(`${localProduct.name} ajoute au panier depuis le cache local.`);
      scanInputRef.current?.focus();
      return;
    }
    const response = await fetch(`${apiUrl}/products/barcode/${encodeURIComponent(term)}`, { headers: authHeaders() }).catch(() => null);
    if (!response?.ok) {
      if (localProduct) {
        await addProduct(localProduct.id);
        setBarcode("");
        setQuery("");
        setMessage(`${localProduct.name} ajoute au panier depuis le cache local.`);
        scanInputRef.current?.focus();
        return;
      }
      setError("Produit introuvable");
      scanInputRef.current?.focus();
      return;
    }
    const product = await response.json() as Product;
    await addProduct(product.id);
    setBarcode("");
    setQuery("");
    setMessage(`${product.name} ajoute au panier.`);
    scanInputRef.current?.focus();
  }

  async function checkout() {
    setError("");
    setMessage("");
    setLastSale(null);
    if (!storeId) {
      setError("Selectionnez un magasin actif avant d encaisser.");
      return;
    }
    if (!warehouseId) {
      setError("Selectionnez un entrepot avant d encaisser.");
      return;
    }
    if (!cashSessionId) {
      setError("Une caisse ouverte est obligatoire avant la vente.");
      return;
    }
    if (!cart.canCheckout) {
      setError("Stock local insuffisant");
      return;
    }
    if (paidAmount <= 0) {
      setError("Entrez le montant reçu avant d encaisser.");
      return;
    }
    if (paidAmount < cart.total) {
      setError(insufficientPaymentMessage(cart.total, paidAmount));
      return;
    }
    setIsLoading(true);
    const paymentPayload = payments
      .map((payment) => ({ method: payment.method, amount: Number(payment.amount || 0), reference: payment.reference || undefined }))
      .filter((payment) => payment.amount > 0);
    const payload = {
      storeId,
      warehouseId,
      cashSessionId,
      customerId: customerId || undefined,
      taxRate: Number(taxRate || 0),
      discount: Number(orderDiscount || 0),
      items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity, discount: item.discount })),
      payments: paymentPayload
    };
    if (!isOnline) {
      await saveLocalSale(payload, paidAmount);
      setIsLoading(false);
      return;
    }
    const response = await fetch(`${apiUrl}/pos/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    }).catch(() => null);
    setIsLoading(false);
    if (!response) {
      await saveLocalSale(payload, paidAmount);
      return;
    }
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    const sale = await response.json() as SaleResponse;
    setLastSale(sale);
    setMessage("Vente finalisee avec succes.");
    clearPosDraft();
    setCart(emptyCart);
    setPayments([{ method: "CASH", amount: "", reference: "" }]);
    setOrderDiscount("0");
    setCustomerId("");
    await Promise.all([loadProducts(), loadRefs()]);
  }

  async function createPosDocument(endpoint: "orders" | "quotes", label: string) {
    setError("");
    setMessage("");
    if (!cart.items.length) {
      setError("Panier vide");
      return;
    }
    if (!warehouseId) {
      setError("Selectionnez un entrepot avant de continuer.");
      return;
    }
    const response = await fetch(`${apiUrl}/pos/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        storeId: storeId || undefined,
        warehouseId,
        customerId: customerId || undefined,
        taxRate: Number(taxRate || 0),
        discount: Number(orderDiscount || 0),
        note: label,
        items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity, discount: item.discount }))
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Action impossible hors ligne pour ce document.");
      return;
    }
    setMessage(`${label} cree avec succes.`);
    clearPosDraft();
    setCart(emptyCart);
    setOrderDiscount("0");
    setCustomerId("");
  }

  async function saveLocalSale(payload: { storeId: string; warehouseId: string; cashSessionId: string; customerId?: string; taxRate: number; discount: number; items: Array<{ productId: string; quantity: number; discount: number }>; payments: Array<{ method: string; amount: number }> }, amount: number) {
    if (amount < cart.total) {
      setError(insufficientPaymentMessage(cart.total, amount));
      return;
    }
    for (const item of cart.items) {
      if (item.availableStock < item.quantity) {
        setError("Stock local insuffisant");
        return;
      }
    }
    const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveOfflineSale({ localId, status: "PENDING", createdOfflineAt: new Date().toISOString(), payload, total: cart.total, message: "Vente en attente de synchronisation" });
    for (const item of cart.items) await updateOfflineProductStock(item.productId, -item.quantity);
    setProducts((current) => current.map((product) => {
      const line = cart.items.find((item) => item.productId === product.id);
      return line ? { ...product, availableStock: Math.max(0, product.availableStock - line.quantity) } : product;
    }));
    setLastSale({ id: localId, total: cart.total, receipt: { number: localId, content: `Ticket local ${localId}` }, invoice: { documentNumber: "En attente", total: cart.total } });
    setMessage(`Vente enregistrée localement. Montant payé: ${formatMoney(amount)}. Le stock sera confirmé à la synchronisation.`);
    clearPosDraft();
    setCart(emptyCart);
    setPayments([{ method: "CASH", amount: "", reference: "" }]);
    setOrderDiscount("0");
    setCustomerId("");
    await refreshPendingCount();
  }

  async function refreshPendingCount() {
    const pending = await getPendingOfflineSales().catch(() => []);
    setPendingOfflineSales(pending.filter((sale) => sale.status !== "SYNCED").length);
  }

  async function synchronizeOfflineSales(manual: boolean) {
    if (!isOnline) {
      setSyncMessage("Hors ligne. Synchronisation impossible pour le moment.");
      return;
    }
    const pending = await getPendingOfflineSales().catch(() => []);
    if (!pending.length) {
      if (manual) setSyncMessage("Aucune vente en attente.");
      return;
    }
    setSyncMessage("Synchronisation en cours...");
    try {
      const result = await syncOfflineSalesNow();
      await refreshPendingCount();
      await Promise.all([loadProducts(), loadRefs()]);
      setSyncMessage(`${result.synced} synchronisée(s), ${result.conflicts} conflit(s), ${result.errors} erreur(s).`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Synchronisation impossible pour le moment.");
    }
  }

  async function createQuickCustomer() {
    setError("");
    setMessage("");
    if (!customerForm.name.trim() || !customerForm.phone.trim()) {
      setError("Nom et téléphone sont obligatoires.");
      return;
    }
    const response = await fetch(`${apiUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        displayName: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        notes: customerForm.notes.trim() || undefined
      })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Creation client impossible.");
      return;
    }
    const customer = await response.json() as Customer;
    setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)]);
    setCustomerId(customer.id);
    setCustomerForm(emptyCustomerForm);
    setShowCustomerModal(false);
    setMessage("Client créé et sélectionné.");
  }

  const activeSession = sessions.find((session) => session.id === cashSessionId);
  const activeStore = stores.find((store) => store.id === storeId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const currentUser = getCurrentUser();
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const cashierName = branding?.userName ?? currentUser?.name ?? "Utilisateur";
  const canCheckout = useMemo(() => cart.items.length > 0 && cart.canCheckout && Boolean(storeId) && Boolean(warehouseId) && Boolean(cashSessionId) && !isLoading, [cart.canCheckout, cart.items.length, cashSessionId, isLoading, storeId, warehouseId]);
  const paidAmount = useMemo(() => roundMoney(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)), [payments]);
  const canReceivePayment = useMemo(() => canCheckout && paidAmount >= cart.total && cart.total > 0, [canCheckout, cart.total, paidAmount]);
  const changeDue = useMemo(() => roundMoney(Math.max(0, paidAmount - cart.total)), [cart.total, paidAmount]);
  const balanceDue = useMemo(() => roundMoney(Math.max(0, cart.total - paidAmount)), [cart.total, paidAmount]);
  const posTemplate = getPosTemplate(business?.businessProfileType, business?.primaryActivity);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white lg:-m-6">
      <div className="grid min-h-screen lg:grid-cols-[1fr_430px]">
        <main className="min-h-0 overflow-auto p-4 lg:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:flex-row xl:items-center">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-brand-600">{posTemplate.eyebrow}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isOnline ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200"}`}>{isOnline ? "En ligne" : "Hors ligne"}</span>
              </div>
              <h1 className="text-2xl font-bold">{posTemplate.title} - {companyName}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{posTemplate.description}</p><p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Local: {activeStore?.name ?? "Aucun"} · Caisse: {activeSession?.cashRegister?.name ?? "Aucune"} · Utilisateur: {cashierName}</p>
              {!isOnline ? <p className="mt-1 text-xs font-semibold text-orange-700 dark:text-orange-200">Mode hors ligne: le stock local sera confirmé à la synchronisation.</p> : null}
            </div>
          </div>

          <div className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[2fr_1fr]">
            <div className="flex gap-2">
              <input ref={scanInputRef} autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setBarcode(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") void scanBarcode(query); }} placeholder={posTemplate.searchPlaceholder} className="min-w-0 flex-1 rounded-md border border-slate-300 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-950" />
              <button onClick={() => void scanBarcode(query)} className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Ajouter</button>
            </div>
            <div className="flex gap-2">
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                <option value="">{posTemplate.defaultCustomer}</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>)}
              </select>
              <button type="button" onClick={() => setShowCustomerModal(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">+ Client</button>
            </div>
          </div>

          {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
          {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-200">{message}</div> : null}
          {syncMessage ? <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">{syncMessage}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {products.map((product) => (
              <button key={product.id} onClick={() => void addProduct(product.id)} className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-600 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.category ?? product.sku}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">Stock {product.availableStock}</span>
                </div>
                <p className="mt-3 text-lg font-bold text-brand-600">{formatMoney(product.salePrice)}</p>
              </button>
            ))}
          </div>
        </main>

        <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:border-l lg:border-t-0">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-xl font-bold">{posTemplate.cartTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{cart.items.length} ligne(s) · {selectedCustomer ? customerLabel(selectedCustomer) : posTemplate.defaultCustomer}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            {cart.items.length ? cart.items.map((item) => (
              <div key={item.productId} className={`rounded-lg border p-3 ${item.hasEnoughStock ? "border-slate-200 dark:border-slate-800" : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"}`}>
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku} - stock dispo {item.availableStock}</p>
                  </div>
                  <button onClick={() => void removeProduct(item.productId)} className="text-sm font-semibold text-red-600">Retirer</button>
                </div>
                <div className="mt-3 grid grid-cols-[100px_1fr] items-center gap-3">
                  <input type="number" min={0} value={item.quantity} onChange={(event) => void updateQuantity(item.productId, Number(event.target.value))} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                  <div className="text-right text-sm">
                    <p>{formatMoney(item.unitPrice)} / unite</p>
                    <p className="font-bold">{formatMoney(item.total)}</p>
                  </div>
                </div>
              </div>
            )) : <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{posTemplate.emptyCart}</div>}

            {lastSale ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                <p className="font-semibold">Derniere vente confirmee</p>
                <p>Recu: {lastSale.receipt?.number ?? "--"}</p>
                <p>Facture: {lastSale.invoice?.documentNumber ?? "--"}</p>
                <a href={receiptPreviewUrl(lastSale, companyName, cashierName)} className="mt-2 inline-flex rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white">Imprimer ticket</a>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="grid gap-2 text-sm">
              <label className="grid gap-1">Remise globale
                <input value={orderDiscount} onChange={(event) => setOrderDiscount(event.target.value)} onBlur={() => void syncCart("calculate")} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            </div>
            <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{formatMoney(cart.total)}</span></div>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-sm font-semibold">Paiement</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr]">
                <select value={payments[0]?.method ?? "CASH"} onChange={(event) => updatePayment(0, { method: event.target.value })} className="rounded-md border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte</option>
                  <option value="BANK_TRANSFER">Virement</option>
                </select>
                <input value={payments[0]?.amount ?? ""} onChange={(event) => setCashPayment(event.target.value)} placeholder="Montant reçu" className="rounded-md border border-slate-300 px-3 py-3 text-lg font-semibold dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCashPayment(String(cart.total))} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Paiement exact</button>
              </div>
              <button type="button" onClick={() => setShowExpertOptions((current) => !current)} className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Mode expert</button>
              {showExpertOptions ? (
                <div className="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                  <TotalLine label="Sous-total" value={cart.subtotal} />
                  <TotalLine label="Remises" value={cart.itemDiscount + cart.discount} />
                  {cart.tax > 0 ? <TotalLine label="Taxes" value={cart.tax} /> : null}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="">Magasin actif</option>
                      {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                    </select>
                    <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="">Dépôt</option>
                      {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                    </select>
                    <select value={cashSessionId} onChange={(event) => setCashSessionId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="">Caisse active</option>
                      {sessions.map((session) => <option key={session.id} value={session.id}>{session.cashRegister?.name ?? "Caisse"}</option>)}
                    </select>
                  </div>
                  <label className="grid gap-1 text-sm">Taxe
                    <select value={taxRate} onChange={(event) => { setTaxRate(event.target.value); void syncCart("calculate", { taxRate: Number(event.target.value) }); }} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="0">Aucune taxe</option>
                      <option value="0.1">10%</option>
                      <option value="0.15">15%</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setPayments((current) => [...current, { method: "CASH", amount: "", reference: "" }])} className="text-xs font-semibold text-brand-600">+ Ajouter un autre paiement</button>
                  {payments.slice(1).map((payment, index) => {
                    const paymentIndex = index + 1;
                    return (
                      <div key={paymentIndex} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <select value={payment.method} onChange={(event) => updatePayment(paymentIndex, { method: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                          <option value="CASH">Espèces</option>
                          <option value="CARD">Carte</option>
                          <option value="BANK_TRANSFER">Virement</option>
                          <option value="MIXED">Mixte</option>
                        </select>
                        <input value={payment.amount} onChange={(event) => updatePayment(paymentIndex, { amount: event.target.value })} placeholder="Montant" className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
                        <button type="button" onClick={() => removePayment(paymentIndex)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Retirer</button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <TotalLine label="Montant reçu" value={paidAmount} />
            <TotalLine label="Monnaie rendue" value={changeDue} />
            {balanceDue > 0 ? <TotalLine label="Balance" value={balanceDue} /> : null}
            {cart.items.length > 0 && paidAmount > 0 && paidAmount < cart.total ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-200">
                {insufficientPaymentMessage(cart.total, paidAmount)}
              </p>
            ) : null}
            <button onClick={() => void checkout()} disabled={!canReceivePayment} className="w-full rounded-md bg-brand-600 px-4 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? "Validation..." : "Encaisser"}</button>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => void createPosDocument("orders", posTemplate.pendingLabel)} disabled={!cart.items.length} className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">{posTemplate.pendingLabel}</button>
              {lastSale ? (
                <a href={receiptPreviewUrl(lastSale, companyName, cashierName)} className="rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-semibold dark:border-slate-700">Imprimer</a>
              ) : (
                <button disabled className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold opacity-50 dark:border-slate-700">Imprimer</button>
              )}
            </div>
            {showExpertOptions ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={() => void createPosDocument("quotes", "Devis POS")} disabled={!cart.items.length} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">Créer devis</button>
                <button onClick={() => void createPosDocument("orders", "Commande POS")} disabled={!cart.items.length} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">Créer commande</button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      {showCustomerModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Nouveau client</h2>
                <p className="text-sm text-slate-500">Création rapide sans quitter la vente.</p>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">Nom *
                <input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Téléphone *
                <input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Adresse
                <input value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Email
                <input type="email" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="grid gap-1 text-sm font-semibold">Note
                <textarea value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <button onClick={() => void createQuickCustomer()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Créer et sélectionner</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TotalLine({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between text-sm"><span>{label}</span><b>{formatMoney(value)}</b></div>;
}

function customerLabel(customer: Customer) {
  return customer.displayName || customer.phone || customer.mobile || customer.whatsapp || "Client";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-HT", { style: "currency", currency: "HTG", maximumFractionDigits: 2 }).format(value || 0);
}

function insufficientPaymentMessage(total: number, paidAmount: number) {
  const missing = roundMoney(total - paidAmount);
  return `Montant insuffisant. Le client doit payer au minimum ${formatMoney(total)}. Il manque ${formatMoney(missing)}.`;
}

function receiptPreviewUrl(sale: SaleResponse, companyName: string, cashierName: string) {
  const receiptText = sale.receipt?.content ?? `Ticket de vente\nRecu: ${sale.receipt?.number ?? sale.id}\nTotal: ${formatMoney(Number(sale.total ?? 0))}`;
  const params = new URLSearchParams({
    companyName: companyName || "Mon entreprise",
    cashierName: cashierName || "Utilisateur",
    receiptNumber: sale.receipt?.number ?? sale.id,
    content: receiptText
  });
  return `/dashboard/pos/print?${params.toString()}`;
}

function escapeHtml(value: string) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getPosTemplate(profileType?: string, primaryActivity?: string | null) {
  const activity = (primaryActivity ?? "").toLowerCase();
  if (profileType === "restaurant" || activity.includes("restaurant") || activity.includes("bar") || activity.includes("cafe")) {
    return {
      eyebrow: "POS Restaurant",
      title: "Commande restaurant",
      description: "Prise de commande, table, cuisine, paiement et ticket.",
      searchPlaceholder: "Rechercher plat, boisson, menu ou scanner",
      defaultCustomer: "Client comptoir",
      cartTitle: "Commande",
      emptyCart: "Commande vide. Ajoutez un plat, une boisson ou un menu.",
      pendingLabel: "Envoyer en cuisine"
    };
  }
  if (profileType === "pharmacy" || activity.includes("pharmacie")) {
    return {
      eyebrow: "POS Pharmacie",
      title: "Vente pharmacie",
      description: "Vente de médicaments, produits pharmacie et ordonnances.",
      searchPlaceholder: "Rechercher médicament, SKU, code-barres ou ordonnance",
      defaultCustomer: "Patient comptoir",
      cartTitle: "Ordonnance / Panier",
      emptyCart: "Panier vide. Ajoutez un médicament ou un produit pharmacie.",
      pendingLabel: "Mettre en attente"
    };
  }
  if (profileType === "clinic" || activity.includes("clinique")) {
    return {
      eyebrow: "Encaissement clinique",
      title: "Facturation clinique",
      description: "Encaissement consultation, examen, traitement ou service médical.",
      searchPlaceholder: "Rechercher consultation, examen ou traitement",
      defaultCustomer: "Patient",
      cartTitle: "Services à facturer",
      emptyCart: "Aucun service ajouté. Ajoutez une consultation ou un traitement.",
      pendingLabel: "Garder en attente"
    };
  }
  if (profileType === "hotel" || activity.includes("hotel")) {
    return {
      eyebrow: "Paiement hôtel",
      title: "Check-in / Check-out",
      description: "Encaisser chambre, réservation, service ou paiement client.",
      searchPlaceholder: "Rechercher chambre, service ou réservation",
      defaultCustomer: "Client hôtel",
      cartTitle: "Séjour / Services",
      emptyCart: "Aucun service ajouté. Ajoutez une chambre ou un service.",
      pendingLabel: "Mettre en réservation"
    };
  }
  if (profileType === "garage" || activity.includes("garage")) {
    return {
      eyebrow: "Facturation garage",
      title: "Réparation et pièces",
      description: "Facturer réparation, pièces, diagnostic, acompte ou solde.",
      searchPlaceholder: "Rechercher pièce, service ou diagnostic",
      defaultCustomer: "Client garage",
      cartTitle: "Réparation",
      emptyCart: "Dossier vide. Ajoutez une pièce ou un service.",
      pendingLabel: "Mettre en réparation"
    };
  }
  if (profileType === "manufacturing" || profileType === "windows-aluminium" || activity.includes("fabrication") || activity.includes("aluminium")) {
    return {
      eyebrow: "Devis / Commande",
      title: "Projet fabrication",
      description: "Créer devis, commande, acompte, solde et livraison.",
      searchPlaceholder: "Rechercher matière, produit fini ou service",
      defaultCustomer: "Client projet",
      cartTitle: "Projet",
      emptyCart: "Projet vide. Ajoutez matière, produit fini ou service.",
      pendingLabel: "Créer projet"
    };
  }
  if (profileType === "school" || activity.includes("ecole")) {
    return {
      eyebrow: "Paiement scolaire",
      title: "Frais scolaires",
      description: "Encaisser écolage, inscription, uniforme, transport ou service.",
      searchPlaceholder: "Rechercher frais, uniforme, livre ou service",
      defaultCustomer: "Élève comptoir",
      cartTitle: "Paiement élève",
      emptyCart: "Aucun frais ajouté. Ajoutez écolage ou service.",
      pendingLabel: "Mettre en attente"
    };
  }
  return {
    eyebrow: "Point de vente",
    title: "Nouvelle vente",
    description: "Vente rapide, paiement, stock et ticket.",
    searchPlaceholder: "Rechercher ou scanner un produit",
    defaultCustomer: "Client comptoir",
    cartTitle: "Panier",
    emptyCart: "Panier vide. Ajoutez un produit pour commencer.",
    pendingLabel: "Mettre en attente"
  };
}

function calculateLocalCart(items: Array<{ productId: string; quantity: number; discount?: number }>, products: Product[], taxRate: number, discount: number): Cart {
  let subtotal = 0;
  let itemDiscount = 0;
  let tax = 0;
  const lines = items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) throw new Error("Produit introuvable dans le cache local");
    const lineDiscount = item.discount ?? 0;
    const base = product.salePrice * item.quantity;
    const taxable = Math.max(0, base - lineDiscount);
    const lineTax = roundMoney(taxable * taxRate);
    const total = roundMoney(taxable + lineTax);
    subtotal += base;
    itemDiscount += lineDiscount;
    tax += lineTax;
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitPrice: product.salePrice,
      quantity: item.quantity,
      discount: lineDiscount,
      tax: lineTax,
      total,
      availableStock: product.availableStock,
      hasEnoughStock: product.availableStock >= item.quantity
    };
  });
  const total = roundMoney(subtotal - itemDiscount - discount + tax);
  return {
    items: lines,
    subtotal: roundMoney(subtotal),
    itemDiscount: roundMoney(itemDiscount),
    discount,
    tax: roundMoney(tax),
    total,
    taxRate,
    canCheckout: lines.length > 0 && lines.every((line) => line.hasEnoughStock) && total >= 0
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function posDraftKey() {
  const user = getCurrentUser();
  return `vta_pos_draft_${user?.tenantId ?? "default"}`;
}

function loadPosDraft() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(posDraftKey());
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as PosDraft;
    return draft.cart?.items ? draft : null;
  } catch {
    return null;
  }
}

function savePosDraft(draft: PosDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(posDraftKey(), JSON.stringify(draft));
}

function clearPosDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(posDraftKey());
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Operation impossible";
  } catch {
    return "Operation impossible";
  }
}



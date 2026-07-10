"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearSession, getAccessToken, getCurrentUser } from "@/lib/auth";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";
import { getOfflinePosContext, getOfflineProducts, getPendingOfflineSales, saveOfflinePosContext, saveOfflineProducts, saveOfflineSale, updateOfflineProductStock } from "@/lib/offline-db";
import { syncOfflineSalesNow } from "@/lib/offline-sync";
import { useNetworkStatus } from "@/lib/network-status";
import { getTenantBusinessConfiguration, type TenantBusinessConfiguration } from "@/lib/business-profiles";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Product = { id: string; name: string; sku: string; salePrice: number; availableStock: number; image?: string | null; primaryBarcode?: string | null; category?: string | null };
type Store = { id: string; name: string; code: string };
type Warehouse = { id: string; name: string; code: string; storeId?: string | null };
type CashSession = { id: string; status: string; cashRegister?: { name: string } };
type Customer = { id: string; displayName?: string | null; phone?: string | null; mobile?: string | null; whatsapp?: string | null };
type CustomItemType = "OUT_OF_STOCK_PRODUCT" | "SERVICE" | "CUSTOM_WORK" | "OTHER";
type CartPayloadItem = { productId?: string | null; customId?: string; customName?: string; customType?: CustomItemType; customNote?: string; unitPrice?: number; quantity: number; discount?: number };
type CartLine = { productId?: string | null; customId?: string; sku: string; name: string; unitPrice: number; quantity: number; discount: number; tax: number; total: number; availableStock: number; hasEnoughStock: boolean; isCustom?: boolean; customName?: string; customType?: CustomItemType; customNote?: string };
type Cart = { items: CartLine[]; subtotal: number; itemDiscount: number; discount: number; tax: number; total: number; taxRate: number; canCheckout: boolean };
type SaleHistory = { id: string; total: string | number; createdAt: string; receipt?: { number: string } | null; invoice?: { documentNumber: string } | null };
type SaleResponse = { id: string; total: string | number; receipt?: { number: string; content: string } | null; invoice?: { documentNumber: string; total: string | number } | null };
type PaymentLine = { method: string; amount: string; reference: string };
type CustomerForm = { name: string; phone: string; address: string; email: string; notes: string };
type CustomItemForm = { name: string; price: string; quantity: string; discount: string; note: string; type: CustomItemType };
type PosDraft = { cart: Cart; customerId: string; payments: PaymentLine[]; orderDiscount: string; taxRate: string; storeId: string; warehouseId: string; cashSessionId: string; updatedAt: string };

const emptyCart: Cart = { items: [], subtotal: 0, itemDiscount: 0, discount: 0, tax: 0, total: 0, taxRate: 0, canCheckout: false };
const emptyCustomerForm: CustomerForm = { name: "", phone: "", address: "", email: "", notes: "" };
const emptyCustomItemForm: CustomItemForm = { name: "", price: "", quantity: "1", discount: "0", note: "", type: "SERVICE" };

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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [pendingOfflineSales, setPendingOfflineSales] = useState(0);
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [business, setBusiness] = useState<TenantBusinessConfiguration | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomerForm);
  const [customItemForm, setCustomItemForm] = useState<CustomItemForm>(emptyCustomItemForm);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${getAccessToken()}` }), []);
  const cartPayload = useCallback(() => ({
    storeId: storeId || undefined,
    warehouseId: warehouseId || undefined,
    taxRate: parseMoney(taxRate),
    discount: parseMoney(orderDiscount),
    items: cart.items.map(cartLineToPayload)
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
      const cachedContext = await getOfflinePosContext();
      if (cachedContext) {
        setStores(cachedContext.stores ?? []);
        setStoreId((current) => current || cachedContext.stores?.[0]?.id || "");
        setWarehouses(cachedContext.warehouses ?? []);
        setWarehouseId((current) => current || cachedContext.warehouses?.[0]?.id || "");
        const openSessions = (cachedContext.sessions ?? []).filter((session) => session.status === "OPEN");
        setSessions(openSessions);
        setCashSessionId((current) => current || openSessions[0]?.id || "");
        setCustomers(cachedContext.customers ?? []);
        setMessage("Mode hors ligne: magasin, dépôt, caisse et clients restaurés depuis ce téléphone.");
        return;
      }
      const apiMessage = response ? await readError(response) : "";
      setError(apiMessage || "Impossible de charger le magasin, le dépôt et la caisse active. Reconnectez-vous ou ouvrez le POS une fois avec internet avant d'utiliser le mode hors ligne.");
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
    await saveOfflinePosContext({ stores: data.stores ?? [], warehouses: data.warehouses ?? [], sessions: openSessions, customers: data.customers ?? [] });
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
    const hasDraft = cart.items.length > 0 || Boolean(customerId) || parseMoney(orderDiscount) > 0 || payments.some((payment) => parseMoney(payment.amount) > 0);
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

  async function syncCart(endpoint: "add" | "update" | "remove" | "calculate", extra: Record<string, unknown> = {}) {
    setError("");
    const payload = { ...cartPayload(), ...extra };
    if (!isOnline) {
      setCart(calculateLocalCart(payload.items as CartPayloadItem[], products, parseMoney(payload.taxRate), parseMoney(payload.discount)));
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
      setCart(calculateLocalCart(payload.items as CartPayloadItem[], products, parseMoney(payload.taxRate), parseMoney(payload.discount)));
      setMessage("Mode hors ligne active. Le panier utilise le stock local.");
    }
  }

  async function addProduct(productId: string) {
    await syncCart("add", { productId, quantity: 1 });
  }

  async function updateQuantity(lineId: string, quantity: number) {
    const nextItems = cart.items
      .map((item) => lineKey(item) === lineId ? { ...item, quantity: Math.max(0, quantity) } : item)
      .filter((item) => item.quantity > 0)
      .map(cartLineToPayload);
    await syncCart("calculate", { items: nextItems });
  }

  async function removeProduct(lineId: string) {
    const nextItems = cart.items.filter((item) => lineKey(item) !== lineId).map(cartLineToPayload);
    await syncCart("calculate", { items: nextItems });
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
      .map((payment) => ({ method: payment.method, amount: parseMoney(payment.amount), reference: payment.reference || undefined }))
      .filter((payment) => payment.amount > 0);
    const payload = {
      storeId,
      warehouseId,
      cashSessionId,
      customerId: customerId || undefined,
      taxRate: parseMoney(taxRate),
      discount: parseMoney(orderDiscount),
      items: cart.items.map(cartLineToPayload),
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
        taxRate: parseMoney(taxRate),
        discount: parseMoney(orderDiscount),
        note: label,
        items: cart.items.map(cartLineToPayload)
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

  async function saveLocalSale(payload: { storeId: string; warehouseId: string; cashSessionId: string; customerId?: string; taxRate: number; discount: number; items: CartPayloadItem[]; payments: Array<{ method: string; amount: number }> }, amount: number) {
    if (amount < cart.total) {
      setError(insufficientPaymentMessage(cart.total, amount));
      return;
    }
    for (const item of cart.items) {
      if (item.isCustom) continue;
      if (item.availableStock < item.quantity) {
        setError("Stock local insuffisant");
        return;
      }
    }
    const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveOfflineSale({ localId, status: "PENDING", createdOfflineAt: new Date().toISOString(), payload, total: cart.total, message: "Vente en attente de synchronisation" });
    for (const item of cart.items) if (item.productId) await updateOfflineProductStock(item.productId, -item.quantity);
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
    const response = await fetch(`${apiUrl}/pos/customers`, {
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

  async function addCustomItem() {
    setError("");
    setMessage("");
    const name = customItemForm.name.trim();
    const price = parseMoney(customItemForm.price);
    const quantity = Math.max(1, Math.floor(parseMoney(customItemForm.quantity || 1)));
    const discount = Math.max(0, parseMoney(customItemForm.discount || 0));
    if (!name) {
      setError("Le nom ou la description est obligatoire.");
      return;
    }
    if (customItemForm.price.trim() === "" || !Number.isFinite(price) || price < 0) {
      setError("Le prix réel est obligatoire et doit être supérieur ou égal à 0.");
      return;
    }
    const nextItems = [
      ...cart.items.map(cartLineToPayload),
      {
        customId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        customName: name,
        customType: customItemForm.type,
        customNote: customItemForm.note.trim() || undefined,
        unitPrice: price,
        quantity,
        discount
      }
    ];
    await syncCart("calculate", { items: nextItems });
    setCustomItemForm(emptyCustomItemForm);
    setShowCustomItemModal(false);
    setMessage("Article personnalisé ajouté au panier.");
  }

  const activeSession = sessions.find((session) => session.id === cashSessionId);
  const activeStore = stores.find((store) => store.id === storeId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const currentUser = getCurrentUser();
  const companyName = branding?.companyName ?? currentUser?.tenant ?? "Mon entreprise";
  const cashierName = branding?.userName ?? currentUser?.name ?? "Utilisateur";
  const canCheckout = useMemo(() => cart.items.length > 0 && cart.canCheckout && Boolean(storeId) && Boolean(warehouseId) && Boolean(cashSessionId) && !isLoading, [cart.canCheckout, cart.items.length, cashSessionId, isLoading, storeId, warehouseId]);
  const paidAmount = useMemo(() => roundMoney(payments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0)), [payments]);
  const canReceivePayment = useMemo(() => canCheckout && paidAmount >= cart.total && cart.total > 0, [canCheckout, cart.total, paidAmount]);
  const changeDue = useMemo(() => roundMoney(Math.max(0, paidAmount - cart.total)), [cart.total, paidAmount]);
  const balanceDue = useMemo(() => roundMoney(Math.max(0, cart.total - paidAmount)), [cart.total, paidAmount]);
  const posTemplate = getPosTemplate(business?.businessProfileType, business?.primaryActivity);
  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [products]);
  const visibleProducts = useMemo(() => categoryFilter ? products.filter((product) => product.category === categoryFilter) : products, [categoryFilter, products]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white lg:-m-6">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-h-0 overflow-auto px-3 pb-28 pt-3 sm:px-4 lg:p-6">
          <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-200">{posTemplate.eyebrow}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOnline ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-200"}`}>{isOnline ? "En ligne" : "Hors ligne"}</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Nouvelle vente</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{posTemplate.description}</p>
              </div>
              <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950 sm:grid-cols-3 xl:min-w-[520px]">
                <MetaPill label="Magasin" value={activeStore?.name ?? "Non chargé"} />
                <MetaPill label="Caisse" value={activeSession?.cashRegister?.name ?? "Non chargée"} />
                <MetaPill label="Utilisateur" value={cashierName} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
              <div className="flex min-w-0 gap-2">
                <input ref={scanInputRef} autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setBarcode(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") void scanBarcode(query); }} placeholder={posTemplate.searchPlaceholder} className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950" />
                <button aria-label="Rechercher un produit" title="Rechercher" onClick={() => void scanBarcode(query)} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-sm transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
                  <span aria-hidden="true">🔍</span>
                </button>
              </div>
              <CustomerSelector customers={customers} customerId={customerId} defaultLabel={posTemplate.defaultCustomer} onChange={setCustomerId} onCreate={() => setShowCustomerModal(true)} />
            </div>
          </section>

          <StatusMessages error={error} message={message} syncMessage={syncMessage} />

          <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Produits disponibles</h2>
              <p className="text-sm text-slate-500">{visibleProducts.length} produit(s) affiché(s)</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setShowCustomItemModal(true)} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600">
                Ajouter article personnalisé
              </button>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900">
                <option value="">Toutes les catégories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          </section>

          {visibleProducts.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={() => void addProduct(product.id)} />
              ))}
            </div>
          ) : (
            <EmptyProductsState />
          )}
        </main>

        <div className="hidden min-h-0 lg:block">
          <CartPanel
            cart={cart}
            selectedCustomerLabel={selectedCustomer ? customerLabel(selectedCustomer) : posTemplate.defaultCustomer}
            cartTitle={posTemplate.cartTitle}
            emptyCart={posTemplate.emptyCart}
            lastSale={lastSale}
            branding={branding}
            companyName={companyName}
            cashierName={cashierName}
            orderDiscount={orderDiscount}
            setOrderDiscount={setOrderDiscount}
            syncCart={() => void syncCart("calculate")}
            payments={payments}
            updatePayment={updatePayment}
            setCashPayment={setCashPayment}
            paidAmount={paidAmount}
            changeDue={changeDue}
            balanceDue={balanceDue}
            canReceivePayment={canReceivePayment}
            isLoading={isLoading}
            showExpertOptions={showExpertOptions}
            setShowExpertOptions={setShowExpertOptions}
            stores={stores}
            warehouses={warehouses}
            sessions={sessions}
            storeId={storeId}
            warehouseId={warehouseId}
            cashSessionId={cashSessionId}
            setStoreId={setStoreId}
            setWarehouseId={setWarehouseId}
            setCashSessionId={setCashSessionId}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            removePayment={removePayment}
            addExtraPayment={() => setPayments((current) => [...current, { method: "CASH", amount: "", reference: "" }])}
            pendingLabel={posTemplate.pendingLabel}
            checkout={() => void checkout()}
            holdSale={() => void createPosDocument("orders", posTemplate.pendingLabel)}
            createQuote={() => void createPosDocument("quotes", "Devis POS")}
            createOrder={() => void createPosDocument("orders", "Commande POS")}
            updateQuantity={(productId, quantity) => void updateQuantity(productId, quantity)}
            removeProduct={(productId) => void removeProduct(productId)}
          />
        </div>
      </div>

      <MobileCartBar cart={cart} paidAmount={paidAmount} onOpen={() => setShowCartDrawer(true)} />
      {showCartDrawer ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden">
          <div className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Ticket</p>
                <h2 className="text-xl font-black">{formatMoney(cart.total)}</h2>
              </div>
              <button onClick={() => setShowCartDrawer(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold dark:border-slate-700">Fermer</button>
            </div>
            <CartPanel
              cart={cart}
              selectedCustomerLabel={selectedCustomer ? customerLabel(selectedCustomer) : posTemplate.defaultCustomer}
              cartTitle={posTemplate.cartTitle}
              emptyCart={posTemplate.emptyCart}
              lastSale={lastSale}
              branding={branding}
              companyName={companyName}
              cashierName={cashierName}
              orderDiscount={orderDiscount}
              setOrderDiscount={setOrderDiscount}
              syncCart={() => void syncCart("calculate")}
              payments={payments}
              updatePayment={updatePayment}
              setCashPayment={setCashPayment}
              paidAmount={paidAmount}
              changeDue={changeDue}
              balanceDue={balanceDue}
              canReceivePayment={canReceivePayment}
              isLoading={isLoading}
              showExpertOptions={showExpertOptions}
              setShowExpertOptions={setShowExpertOptions}
              stores={stores}
              warehouses={warehouses}
              sessions={sessions}
              storeId={storeId}
              warehouseId={warehouseId}
              cashSessionId={cashSessionId}
              setStoreId={setStoreId}
              setWarehouseId={setWarehouseId}
              setCashSessionId={setCashSessionId}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              removePayment={removePayment}
              addExtraPayment={() => setPayments((current) => [...current, { method: "CASH", amount: "", reference: "" }])}
              pendingLabel={posTemplate.pendingLabel}
              checkout={() => { void checkout().then(() => setShowCartDrawer(false)); }}
              holdSale={() => void createPosDocument("orders", posTemplate.pendingLabel)}
              createQuote={() => void createPosDocument("quotes", "Devis POS")}
              createOrder={() => void createPosDocument("orders", "Commande POS")}
              updateQuantity={(productId, quantity) => void updateQuantity(productId, quantity)}
              removeProduct={(productId) => void removeProduct(productId)}
            />
          </div>
        </div>
      ) : null}
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
      {showCustomItemModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Article personnalisé</h2>
                <p className="text-sm text-slate-500">Ajoutez un service ou un produit hors stock uniquement pour cette vente.</p>
              </div>
              <button onClick={() => setShowCustomItemModal(false)} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">Nom ou description *
                <input value={customItemForm.name} onChange={(event) => setCustomItemForm((current) => ({ ...current, name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Prix réel *
                  <input type="number" min={0} step="0.01" value={customItemForm.price} onChange={(event) => setCustomItemForm((current) => ({ ...current, price: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="grid gap-1 text-sm font-semibold">Quantité
                  <input type="number" min={1} value={customItemForm.quantity} onChange={(event) => setCustomItemForm((current) => ({ ...current, quantity: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">Type
                  <select value={customItemForm.type} onChange={(event) => setCustomItemForm((current) => ({ ...current, type: event.target.value as CustomItemType }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950">
                    <option value="OUT_OF_STOCK_PRODUCT">Produit hors stock</option>
                    <option value="SERVICE">Service</option>
                    <option value="CUSTOM_WORK">Travail personnalisé</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">Remise
                  <input type="number" min={0} step="0.01" value={customItemForm.discount} onChange={(event) => setCustomItemForm((current) => ({ ...current, discount: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">Note
                <textarea value={customItemForm.note} onChange={(event) => setCustomItemForm((current) => ({ ...current, note: event.target.value }))} rows={3} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <button onClick={() => void addCustomItem()} className="rounded-md bg-amber-500 px-4 py-3 text-sm font-bold text-white">Ajouter au panier</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function CustomerSelector({ customers, customerId, defaultLabel, onChange, onCreate }: { customers: Customer[]; customerId: string; defaultLabel: string; onChange: (value: string) => void; onCreate: () => void }) {
  return (
    <div className="flex min-w-0 gap-2">
      <select value={customerId} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950">
        <option value="">{defaultLabel}</option>
        {customers.map((customer) => <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>)}
      </select>
      <button type="button" aria-label="Ajouter un client" title="Ajouter client" onClick={onCreate} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-300 bg-white text-2xl font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function StatusMessages({ error, message, syncMessage }: { error: string; message: string; syncMessage: string }) {
  return (
    <>
      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
      {message ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{message}</div> : null}
      {syncMessage ? <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">{syncMessage}</div> : null}
    </>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const isLowStock = product.availableStock > 0 && product.availableStock <= 3;
  const isOut = product.availableStock <= 0;
  return (
    <button onClick={onAdd} disabled={isOut} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-brand-500 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <ProductPlaceholder name={product.name} />
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950 dark:text-white">{product.name}</p>
            <p className="truncate text-xs font-semibold text-slate-500">{product.category ?? product.sku}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${isOut ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : isLowStock ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-200" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"}`}>
            {isOut ? "Rupture" : `Stock ${product.availableStock}`}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-xl font-black text-brand-700 dark:text-brand-300">{formatMoney(product.salePrice)}</p>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-xl font-black leading-none text-white opacity-90 transition group-hover:opacity-100 dark:bg-white dark:text-slate-950" aria-label="Ajouter">+</span>
        </div>
      </div>
    </button>
  );
}

function ProductPlaceholder({ name }: { name: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-50 via-emerald-50 to-orange-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/85 text-2xl font-black text-brand-700 shadow-lg shadow-brand-900/10 ring-1 ring-white/70 dark:bg-slate-950/80 dark:text-brand-200 dark:ring-slate-700">
        {productInitials(name)}
      </div>
    </div>
  );
}

function EmptyProductsState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-lg font-black">Aucun produit disponible</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Ajoutez vos produits pour commencer à vendre. Les ventes utilisent uniquement les données réelles de votre entreprise.</p>
      <a href="/dashboard/products/create" className="mt-5 inline-flex rounded-2xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700">Ajouter un produit</a>
    </div>
  );
}

type CartPanelProps = {
  cart: Cart;
  selectedCustomerLabel: string;
  cartTitle: string;
  emptyCart: string;
  lastSale: SaleResponse | null;
  branding: CompanyBranding | null;
  companyName: string;
  cashierName: string;
  orderDiscount: string;
  setOrderDiscount: (value: string) => void;
  syncCart: () => void;
  payments: PaymentLine[];
  updatePayment: (index: number, changes: Partial<PaymentLine>) => void;
  setCashPayment: (amount: string) => void;
  paidAmount: number;
  changeDue: number;
  balanceDue: number;
  canReceivePayment: boolean;
  isLoading: boolean;
  showExpertOptions: boolean;
  setShowExpertOptions: (value: boolean | ((current: boolean) => boolean)) => void;
  stores: Store[];
  warehouses: Warehouse[];
  sessions: CashSession[];
  storeId: string;
  warehouseId: string;
  cashSessionId: string;
  setStoreId: (value: string) => void;
  setWarehouseId: (value: string) => void;
  setCashSessionId: (value: string) => void;
  taxRate: string;
  setTaxRate: (value: string) => void;
  removePayment: (index: number) => void;
  addExtraPayment: () => void;
  pendingLabel: string;
  checkout: () => void;
  holdSale: () => void;
  createQuote: () => void;
  createOrder: () => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
};

function CartPanel(props: CartPanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-xl font-black">{props.cartTitle}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{props.cart.items.length} ligne(s) · {props.selectedCustomerLabel}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {props.cart.items.length ? props.cart.items.map((item) => (
          <CartLineItem key={lineKey(item)} item={item} updateQuantity={props.updateQuantity} removeProduct={props.removeProduct} />
        )) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{props.emptyCart}</div>}

        {props.lastSale ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <p className="font-black">Dernière vente confirmée</p>
            <p>Reçu: {props.lastSale.receipt?.number ?? "--"}</p>
            <p>Facture: {props.lastSale.invoice?.documentNumber ?? "--"}</p>
            <a href={receiptPreviewUrl(props.lastSale, props.branding, props.companyName, props.cashierName)} className="mt-2 inline-flex rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Imprimer ticket</a>
          </div>
        ) : null}
      </div>

      <PaymentPanel {...props} />
    </aside>
  );
}

function CartLineItem({ item, updateQuantity, removeProduct }: { item: CartLine; updateQuantity: (lineId: string, quantity: number) => void; removeProduct: (lineId: string) => void }) {
  const id = lineKey(item);
  return (
    <div className={`rounded-2xl border p-3 ${item.hasEnoughStock ? "border-slate-200 dark:border-slate-800" : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"}`}>
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black">{item.name}</p>
          <p className="text-xs text-slate-500">{item.isCustom ? customTypeLabel(item.customType) : `${item.sku} · stock ${item.availableStock}`}</p>
          {item.isCustom ? <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700 dark:bg-amber-950 dark:text-amber-200">Personnalisé</span> : null}
        </div>
        <button onClick={() => removeProduct(id)} className="shrink-0 text-sm font-bold text-red-600">Retirer</button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
          <button onClick={() => updateQuantity(id, Math.max(0, item.quantity - 1))} className="h-10 w-10 text-lg font-black">-</button>
          <input aria-label={`Quantité ${item.name}`} type="number" min={0} value={item.quantity} onChange={(event) => updateQuantity(id, Math.floor(parseMoney(event.target.value)))} className="h-10 w-16 border-x border-slate-300 bg-white text-center font-bold outline-none dark:border-slate-700 dark:bg-slate-950" />
          <button onClick={() => updateQuantity(id, item.quantity + 1)} className="h-10 w-10 text-lg font-black">+</button>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">{formatMoney(item.unitPrice)}</p>
          <p className="text-base font-black">{formatMoney(item.total)}</p>
        </div>
      </div>
      {!item.hasEnoughStock ? <p className="mt-2 text-xs font-bold text-red-700 dark:text-red-200">Stock insuffisant pour cette quantité.</p> : null}
    </div>
  );
}

function PaymentPanel(props: CartPanelProps) {
  return (
    <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
      <SaleSummary cart={props.cart} paidAmount={props.paidAmount} changeDue={props.changeDue} balanceDue={props.balanceDue} />
      <label className="grid gap-1 text-sm font-bold">Remise globale
        <input value={props.orderDiscount} onChange={(event) => props.setOrderDiscount(event.target.value)} onBlur={props.syncCart} className="rounded-2xl border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="mb-2 text-sm font-black">Paiement</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["CASH", "Cash"],
            ["CARD", "Carte"],
            ["BANK_TRANSFER", "Virement"]
          ].map(([method, label]) => (
            <button key={method} type="button" onClick={() => props.updatePayment(0, { method })} className={`rounded-xl px-3 py-2 text-sm font-bold ${props.payments[0]?.method === method ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{label}</button>
          ))}
        </div>
        <input value={props.payments[0]?.amount ?? ""} onChange={(event) => props.setCashPayment(event.target.value)} placeholder="Montant reçu" className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg font-black outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-brand-950" />
        <button type="button" onClick={() => props.setCashPayment(String(props.cart.total))} className="mt-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">Paiement exact</button>
      </div>
      {props.cart.items.length > 0 && props.paidAmount > 0 && props.paidAmount < props.cart.total ? (
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-200">
          {insufficientPaymentMessage(props.cart.total, props.paidAmount)}
        </p>
      ) : null}
      <button onClick={props.checkout} disabled={!props.canReceivePayment} className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{props.isLoading ? "Validation..." : "Encaisser"}</button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={props.holdSale} disabled={!props.cart.items.length} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold disabled:opacity-50 dark:border-slate-700">{props.pendingLabel}</button>
        {props.lastSale ? <a href={receiptPreviewUrl(props.lastSale, props.branding, props.companyName, props.cashierName)} className="rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-bold dark:border-slate-700">Imprimer</a> : <button disabled className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold opacity-50 dark:border-slate-700">Imprimer</button>}
      </div>
      <button type="button" onClick={() => props.setShowExpertOptions((current) => !current)} className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Mode expert</button>
      {props.showExpertOptions ? <ExpertOptions {...props} /> : null}
    </div>
  );
}

function SaleSummary({ cart, paidAmount, changeDue, balanceDue }: { cart: Cart; paidAmount: number; changeDue: number; balanceDue: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
      <TotalLine label="Sous-total" value={cart.subtotal} />
      {cart.discount + cart.itemDiscount > 0 ? <TotalLine label="Remises" value={cart.discount + cart.itemDiscount} /> : null}
      {cart.tax > 0 ? <TotalLine label="Taxe" value={cart.tax} /> : null}
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-2xl font-black dark:border-slate-800"><span>Total</span><span>{formatMoney(cart.total)}</span></div>
      <div className="mt-2 space-y-1">
        <TotalLine label="Montant reçu" value={paidAmount} />
        <TotalLine label="Monnaie rendue" value={changeDue} />
        {balanceDue > 0 ? <TotalLine label="Balance" value={balanceDue} /> : null}
      </div>
    </div>
  );
}

function ExpertOptions(props: CartPanelProps) {
  return (
    <div className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
      <div className="grid gap-2">
        <select value={props.storeId} onChange={(event) => props.setStoreId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="">Magasin actif</option>
          {props.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
        <select value={props.warehouseId} onChange={(event) => props.setWarehouseId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="">Dépôt</option>
          {props.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <select value={props.cashSessionId} onChange={(event) => props.setCashSessionId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="">Caisse active</option>
          {props.sessions.map((session) => <option key={session.id} value={session.id}>{session.cashRegister?.name ?? "Caisse"}</option>)}
        </select>
        <select value={props.taxRate} onChange={(event) => props.setTaxRate(event.target.value)} onBlur={props.syncCart} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <option value="0">Aucune taxe</option>
          <option value="0.1">10%</option>
          <option value="0.15">15%</option>
        </select>
      </div>
      <button type="button" onClick={props.addExtraPayment} className="text-xs font-bold text-brand-600">+ Ajouter un paiement</button>
      {props.payments.slice(1).map((payment, index) => {
        const paymentIndex = index + 1;
        return (
          <div key={paymentIndex} className="grid gap-2">
            <select value={payment.method} onChange={(event) => props.updatePayment(paymentIndex, { method: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="CASH">Cash</option>
              <option value="CARD">Carte</option>
              <option value="BANK_TRANSFER">Virement</option>
            </select>
            <input value={payment.amount} onChange={(event) => props.updatePayment(paymentIndex, { amount: event.target.value })} placeholder="Montant" className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
            <button type="button" onClick={() => props.removePayment(paymentIndex)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-700">Retirer</button>
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={props.createQuote} disabled={!props.cart.items.length} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50 dark:border-slate-700">Créer devis</button>
        <button onClick={props.createOrder} disabled={!props.cart.items.length} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50 dark:border-slate-700">Créer commande</button>
      </div>
    </div>
  );
}

function MobileCartBar({ cart, paidAmount, onOpen }: { cart: Cart; paidAmount: number; onOpen: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
      <button onClick={onOpen} className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-left text-white dark:bg-white dark:text-slate-950">
        <span>
          <span className="block text-xs font-bold opacity-70">{cart.items.length} article(s) · Reçu {formatMoney(paidAmount)}</span>
          <span className="block text-lg font-black">Voir panier</span>
        </span>
        <span className="text-xl font-black">{formatMoney(cart.total)}</span>
      </button>
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

function productInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "P";
}

function insufficientPaymentMessage(total: number, paidAmount: number) {
  const missing = roundMoney(total - paidAmount);
  return `Montant insuffisant. Le client doit payer au minimum ${formatMoney(total)}. Il manque ${formatMoney(missing)}.`;
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineKey(item: Pick<CartLine, "productId" | "customId" | "name">) {
  return item.productId ?? item.customId ?? item.name;
}

function cartLineToPayload(item: CartLine): CartPayloadItem {
  if (item.isCustom || !item.productId) {
    return {
      customId: item.customId ?? lineKey(item),
      customName: item.customName ?? item.name,
      customType: item.customType ?? "OTHER",
      customNote: item.customNote,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      discount: item.discount
    };
  }
  return { productId: item.productId, quantity: item.quantity, discount: item.discount };
}

function customTypeLabel(type?: CustomItemType) {
  if (type === "OUT_OF_STOCK_PRODUCT") return "Produit hors stock";
  if (type === "CUSTOM_WORK") return "Travail personnalisé";
  if (type === "SERVICE") return "Service";
  return "Article personnalisé";
}

function receiptPreviewUrl(sale: SaleResponse, branding: CompanyBranding | null, companyName: string, cashierName: string) {
  const receiptText = sale.receipt?.content ?? `Ticket de vente\nRecu: ${sale.receipt?.number ?? sale.id}\nTotal: ${formatMoney(parseMoney(sale.total))}`;
  const params = new URLSearchParams({
    companyName: companyName || "Mon entreprise",
    cashierName: cashierName || "Utilisateur",
    receiptNumber: sale.receipt?.number ?? sale.id,
    content: receiptText,
    width: "80"
  });
  if (branding?.logoUrl) params.set("logoUrl", branding.logoUrl);
  if (branding?.phone) params.set("phone", branding.phone);
  if (branding?.address) params.set("address", branding.address);
  if (branding?.email) params.set("email", branding.email);
  if (branding?.taxNumber) params.set("taxNumber", branding.taxNumber);
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

function calculateLocalCart(items: CartPayloadItem[], products: Product[], taxRate: number, discount: number): Cart {
  let subtotal = 0;
  let itemDiscount = 0;
  let tax = 0;
  const lines = items.map((item) => {
    if (!item.productId) {
      const lineDiscount = item.discount ?? 0;
      const unitPrice = Number(item.unitPrice ?? 0);
      const base = unitPrice * item.quantity;
      const taxable = Math.max(0, base - lineDiscount);
      const lineTax = roundMoney(taxable * taxRate);
      const total = roundMoney(taxable + lineTax);
      subtotal += base;
      itemDiscount += lineDiscount;
      tax += lineTax;
      return {
        productId: null,
        customId: item.customId,
        sku: "PERSONNALISE",
        name: item.customName ?? "Article personnalisé",
        unitPrice,
        quantity: item.quantity,
        discount: lineDiscount,
        tax: lineTax,
        total,
        availableStock: 0,
        hasEnoughStock: true,
        isCustom: true,
        customName: item.customName,
        customType: item.customType ?? "OTHER",
        customNote: item.customNote
      };
    }
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
  if (response.status === 401) {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
    return "Session expirée. Reconnectez-vous.";
  }
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Operation impossible";
  } catch {
    return "Operation impossible";
  }
}



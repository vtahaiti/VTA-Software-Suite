"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";

type Ref = { id: string; name: string; symbol?: string };
type Supplier = { id: string; name: string };
type Store = { id: string; name: string };
type Warehouse = { id: string; name: string };
type CategoryForm = { name: string; icon: string };

const hardwareUnitSuggestions = ["pièce", "sac", "tonne", "kg", "mètre", "pied", "feuille", "gallon", "litre", "boîte", "paquet", "verge"];

const emptyCategoryForm: CategoryForm = { name: "", icon: "" };

const emptyForm = {
  name: "",
  sku: "",
  reference: "",
  qrCode: "",
  description: "",
  categoryId: "",
  subCategory: "",
  brandId: "",
  supplierId: "",
  unitId: "",
  customUnit: "",
  purchasePrice: "0",
  salePrice: "0",
  promotionalPrice: "",
  wholesalePrice: "0",
  averageCost: "0",
  taxRate: "0",
  stockInitial: "0",
  minimumStock: "0",
  maximumStock: "0",
  location: "",
  storeId: "",
  warehouseId: "",
  manufacturingDate: "",
  expirationDate: "",
  warrantyMonths: "",
  barcode: "",
  barcodeType: "EAN",
  imageUrl: "",
  galleryUrls: "",
  variantName: "",
  variantColor: "",
  variantSize: "",
  variantModel: "",
  variantCapacity: "",
  variantSku: "",
  variantBarcode: "",
  variantStock: "0",
  noStockTracking: false,
  isActive: true
};

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [refs, setRefs] = useState<{ categories: Ref[]; brands: Ref[]; units: Ref[]; suppliers: Supplier[]; stores: Store[]; warehouses: Warehouse[] }>({
    categories: [],
    brands: [],
    units: [],
    suppliers: [],
    stores: [],
    warehouses: []
  });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);

  useEffect(() => {
    void loadRefs();
    if (productId) void loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const margin = useMemo(() => {
    const sale = Number(form.promotionalPrice || form.salePrice || 0);
    const cost = Number(form.purchasePrice || 0);
    return sale > 0 ? (((sale - cost) / sale) * 100).toFixed(2) : "0.00";
  }, [form.promotionalPrice, form.purchasePrice, form.salePrice]);

  async function loadRefs() {
    const [categoriesResponse, brands, units, suppliers, stores, warehouses] = await Promise.all([
      fetchWithAuth(`${apiUrl}/products/categories`),
      fetchWithAuth(`${apiUrl}/products/brands`),
      fetchWithAuth(`${apiUrl}/products/units`),
      fetchWithAuth(`${apiUrl}/suppliers`),
      fetchWithAuth(`${apiUrl}/stores`),
      fetchWithAuth(`${apiUrl}/warehouses`)
    ]);
    const suppliersData = suppliers.ok ? await suppliers.json() : [];
    const storesData = stores.ok ? await stores.json() : [];
    const warehousesData = warehouses.ok ? await warehouses.json() : [];
    setRefs({
      categories: categoriesResponse.ok ? await categoriesResponse.json() : [],
      brands: brands.ok ? await brands.json() : [],
      units: units.ok ? await units.json() : [],
      suppliers: Array.isArray(suppliersData) ? suppliersData : suppliersData.items ?? [],
      stores: Array.isArray(storesData) ? storesData : storesData.items ?? [],
      warehouses: Array.isArray(warehousesData) ? warehousesData : warehousesData.items ?? []
    });
  }

  async function loadProduct() {
    const response = await fetchWithAuth(`${apiUrl}/products/${productId}`);
    if (!response.ok) return;
    const product = await response.json();
    const variant = product.variants?.[0] ?? {};
    const primaryImage = product.images?.[0]?.url ?? "";
    const stockCurrent = Number(product.stockCurrent ?? product.stocks?.[0]?.quantity ?? 0);
    const noStockTracking = stockCurrent <= 0 && Number(product.minimumStock ?? 0) <= 0 && isNonStockVariant(variant);
    setForm({
      ...emptyForm,
      name: product.name ?? "",
      sku: product.sku ?? "",
      reference: product.reference ?? product.sku ?? "",
      qrCode: product.qrCode ?? "",
      description: product.description ?? "",
      categoryId: product.categoryId ?? "",
      subCategory: product.subCategory ?? "",
      brandId: product.brandId ?? "",
      supplierId: product.supplierId ?? "",
      unitId: product.unitId ?? "",
      purchasePrice: String(product.purchasePrice ?? 0),
      salePrice: String(product.salePrice ?? 0),
      promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : "",
      wholesalePrice: String(product.wholesalePrice ?? 0),
      averageCost: String(product.averageCost ?? 0),
      taxRate: String(product.taxRate ?? 0),
      stockInitial: String(stockCurrent),
      minimumStock: String(product.minimumStock ?? 0),
      maximumStock: String(product.maximumStock ?? 0),
      location: product.location ?? "",
      storeId: product.storeId ?? "",
      warehouseId: product.warehouseId ?? "",
      manufacturingDate: product.manufacturingDate ? String(product.manufacturingDate).slice(0, 10) : "",
      expirationDate: product.expirationDate ? String(product.expirationDate).slice(0, 10) : "",
      warrantyMonths: product.warrantyMonths ? String(product.warrantyMonths) : "",
      barcode: product.barcodes?.[0]?.value ?? "",
      barcodeType: product.barcodes?.[0]?.type ?? "EAN",
      imageUrl: primaryImage,
      galleryUrls: (product.images ?? []).slice(1).map((image: { url: string }) => image.url).join("\n"),
      variantName: variant.name ?? "",
      variantColor: variant.color ?? "",
      variantSize: variant.size ?? "",
      variantModel: variant.model ?? "",
      variantCapacity: variant.capacity ?? "",
      variantSku: variant.sku ?? "",
      variantBarcode: variant.barcode ?? "",
      variantStock: String(variant.stock ?? 0),
      noStockTracking,
      isActive: product.isActive
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const unitId = await resolveUnitId();
    if (unitId === null) return;

    const gallery = form.galleryUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    const noStock = Boolean(form.noStockTracking);
    const variants = buildVariants(noStock);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      reference: form.reference.trim() || undefined,
      qrCode: form.qrCode.trim() || undefined,
      description: form.description.trim() || undefined,
      categoryId: form.categoryId || undefined,
      subCategory: form.subCategory.trim() || undefined,
      brandId: form.brandId || undefined,
      supplierId: form.supplierId || undefined,
      unitId,
      purchasePrice: Number(form.purchasePrice || 0),
      salePrice: Number(form.salePrice || 0),
      promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : undefined,
      wholesalePrice: Number(form.wholesalePrice || 0),
      averageCost: Number(form.averageCost || 0),
      taxRate: Number(form.taxRate || 0),
      stockInitial: noStock ? 0 : Number(form.stockInitial || 0),
      minimumStock: noStock ? 0 : Number(form.minimumStock || 0),
      maximumStock: Number(form.maximumStock || 0),
      location: form.location.trim() || undefined,
      storeId: form.storeId || undefined,
      warehouseId: form.warehouseId || undefined,
      manufacturingDate: form.manufacturingDate || undefined,
      expirationDate: form.expirationDate || undefined,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
      isActive: form.isActive,
      barcodes: form.barcode ? [{ value: form.barcode, type: form.barcodeType, isPrimary: true }] : undefined,
      images: [
        ...(form.imageUrl ? [{ url: form.imageUrl, alt: form.name, sortOrder: 0 }] : []),
        ...gallery.map((url, index) => ({ url, alt: form.name, sortOrder: index + 1 }))
      ],
      variants
    };
    const response = await fetchWithAuth(productId ? `${apiUrl}/products/${productId}` : `${apiUrl}/products`, {
      method: productId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    setMessage("Produit enregistré.");
    router.push("/dashboard/products");
  }

  async function resolveUnitId() {
    if (form.unitId) return form.unitId;
    const name = form.customUnit.trim();
    if (!name) return undefined;
    const existing = refs.units.find((unit) => [unit.name, unit.symbol].filter(Boolean).some((value) => value?.toLowerCase() === name.toLowerCase()));
    if (existing) return existing.id;
    const response = await fetchWithAuth(`${apiUrl}/products/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, symbol: name })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Création unité impossible.");
      return null;
    }
    const unit = await response.json() as Ref;
    setRefs((current) => ({ ...current, units: [unit, ...current.units.filter((item) => item.id !== unit.id)] }));
    return unit.id;
  }

  function buildVariants(noStock: boolean) {
    const hasVariant = form.variantName || form.variantColor || form.variantSize || form.variantModel || form.variantCapacity || form.variantSku || form.variantBarcode || form.variantStock !== "0" || noStock;
    if (!hasVariant) return undefined;
    return [{
      name: form.variantName || form.name,
      color: form.variantColor || undefined,
      size: form.variantSize || undefined,
      model: noStock ? "Produit sans suivi de stock" : form.variantModel || undefined,
      capacity: form.variantCapacity || undefined,
      sku: form.variantSku || undefined,
      barcode: form.variantBarcode || undefined,
      stock: noStock ? 0 : Number(form.variantStock || 0)
    }];
  }

  async function createCategory() {
    setError(null);
    setMessage(null);
    if (!categoryForm.name.trim()) {
      setError("Nom de catégorie obligatoire.");
      return;
    }
    const response = await fetchWithAuth(`${apiUrl}/products/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryForm.name.trim(), icon: categoryForm.icon.trim() || undefined })
    }).catch(() => null);
    if (!response?.ok) {
      setError(response ? await readError(response) : "Création catégorie impossible.");
      return;
    }
    const category = await response.json() as Ref;
    setRefs((current) => ({ ...current, categories: [category, ...current.categories.filter((item) => item.id !== category.id)] }));
    update("categoryId", category.id);
    setCategoryForm(emptyCategoryForm);
    setShowCategoryModal(false);
    setMessage("Catégorie créée et sélectionnée.");
  }

  function update(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function generateBarcode() {
    const value = Date.now().toString().slice(-12).padStart(12, "0");
    setForm((current) => ({ ...current, barcode: value, barcodeType: "EAN", qrCode: current.qrCode || `PROD:${current.sku || current.name}:${value}` }));
  }

  return <form onSubmit={submit} className="space-y-5">
    {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    <Section title="Produit">
      <Input value={form.name} onChange={(value) => update("name", value)} placeholder="Nom du produit *" required />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select value={form.categoryId} onChange={(value) => update("categoryId", value)} placeholder="Catégorie" items={refs.categories} />
        <button type="button" onClick={() => setShowCategoryModal(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">+ Nouvelle catégorie</button>
      </div>
      <Input value={form.purchasePrice} onChange={(value) => update("purchasePrice", value)} placeholder="Prix d'achat / coût - facultatif" type="number" />
      <Input value={form.salePrice} onChange={(value) => update("salePrice", value)} placeholder="Prix de vente *" type="number" required />
      <Input value={form.stockInitial} onChange={(value) => update("stockInitial", value)} placeholder={productId ? "Quantité initiale / stock actuel" : "Quantité initiale"} type="number" />
      <Input value={form.minimumStock} onChange={(value) => update("minimumStock", value)} placeholder="Quantité minimale pour stock faible" type="number" helper="Alerte quand le stock arrive à ce niveau." />
      <ImagePicker label="Image produit" selected={Boolean(form.imageUrl)} onChange={(value) => update("imageUrl", value)} />
      <textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Description courte facultative" rows={3} className="min-h-24 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" />
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Produit actif
      </label>
    </Section>

    <details open={showAdvancedOptions} onToggle={(event) => setShowAdvancedOptions(event.currentTarget.open)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <summary className="cursor-pointer text-lg font-semibold text-slate-950 dark:text-white">Options avancées</summary>
      {showAdvancedOptions ? <div className="mt-5 space-y-5">
        <Section title="Codes et références">
          <Input value={form.sku} onChange={(value) => update("sku", value)} placeholder="SKU automatique si vide" />
          <div className="flex gap-2">
            <Input value={form.barcode} onChange={(value) => update("barcode", value)} placeholder="Code-barres" />
            <button type="button" onClick={generateBarcode} className="rounded-md border px-3 py-2 text-sm font-semibold">Générer</button>
          </div>
          <Input value={form.qrCode} onChange={(value) => update("qrCode", value)} placeholder="QR code" />
          <Input value={form.reference} onChange={(value) => update("reference", value)} placeholder="Référence interne ou fournisseur" />
        </Section>

        <Section title="Classification">
          <Input value={form.subCategory} onChange={(value) => update("subCategory", value)} placeholder="Sous-catégorie" />
          <Select value={form.brandId} onChange={(value) => update("brandId", value)} placeholder="Marque" items={refs.brands} />
          <Select value={form.supplierId} onChange={(value) => update("supplierId", value)} placeholder="Fournisseur principal" items={refs.suppliers} />
          <Select value={form.unitId} onChange={(value) => update("unitId", value)} placeholder="Unité" items={refs.units} />
          <Input value={form.customUnit} onChange={(value) => update("customUnit", value)} placeholder="Nouvelle unité" />
          <p className="text-xs text-slate-500 md:col-span-2">Suggestions matériaux : {hardwareUnitSuggestions.join(", ")}.</p>
        </Section>

        <Section title="Prix avancés">
          <Input value={form.promotionalPrice} onChange={(value) => update("promotionalPrice", value)} placeholder="Prix promotionnel" type="number" />
          <Input value={form.wholesalePrice} onChange={(value) => update("wholesalePrice", value)} placeholder="Prix gros" type="number" />
          <Input value={form.averageCost} onChange={(value) => update("averageCost", value)} placeholder="Coût moyen" type="number" />
          <Input value={form.taxRate} onChange={(value) => update("taxRate", value)} placeholder="Taxe" type="number" />
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-200">Marge calculée : {margin}%</div>
        </Section>

        <Section title="Stock et emplacement">
          <Input value={form.maximumStock} onChange={(value) => update("maximumStock", value)} placeholder="Stock maximum" type="number" />
          <Input value={form.location} onChange={(value) => update("location", value)} placeholder="Emplacement" />
          <Select value={form.storeId} onChange={(value) => update("storeId", value)} placeholder="Magasin" items={refs.stores} />
          <Select value={form.warehouseId} onChange={(value) => update("warehouseId", value)} placeholder="Dépôt" items={refs.warehouses} />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.noStockTracking} onChange={(event) => update("noStockTracking", event.target.checked)} />
            Produit sans suivi de stock
          </label>
        </Section>

        <Section title="Variantes et détails">
          <Input value={form.variantName} onChange={(value) => update("variantName", value)} placeholder="Nom variante" />
          <Input value={form.variantColor} onChange={(value) => update("variantColor", value)} placeholder="Couleur" />
          <Input value={form.variantSize} onChange={(value) => update("variantSize", value)} placeholder="Dimensions" />
          <Input value={form.variantModel} onChange={(value) => update("variantModel", value)} placeholder="Type / matériau" />
          <Input value={form.variantCapacity} onChange={(value) => update("variantCapacity", value)} placeholder="Épaisseur / longueur" />
          <Input value={form.variantStock} onChange={(value) => update("variantStock", value)} placeholder="Stock variante" type="number" />
          <Input value={form.variantSku} onChange={(value) => update("variantSku", value)} placeholder="SKU variante" />
          <Input value={form.variantBarcode} onChange={(value) => update("variantBarcode", value)} placeholder="Code-barres variante" />
        </Section>

        <Section title="Images et dates">
          <GalleryPicker selected={Boolean(form.galleryUrls)} onChange={(value) => update("galleryUrls", value)} />
          <input type="date" value={form.manufacturingDate} onChange={(event) => update("manufacturingDate", event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <input type="date" value={form.expirationDate} onChange={(event) => update("expirationDate", event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          <Input value={form.warrantyMonths} onChange={(value) => update("warrantyMonths", value)} placeholder="Garantie en mois" type="number" />
        </Section>
      </div> : null}
    </details>

    <div className="flex items-center gap-3">
      <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}
    </div>

    {showCategoryModal ? (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Nouvelle catégorie</h2>
              <p className="text-sm text-slate-500">Création rapide sans quitter le produit.</p>
            </div>
            <button type="button" onClick={() => setShowCategoryModal(false)} className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold dark:border-slate-700">Fermer</button>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">Nom *
              <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">Icône
              <input value={categoryForm.icon} onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <button type="button" onClick={() => void createCategory()} className="rounded-md bg-brand-600 px-4 py-3 text-sm font-bold text-white">Créer et sélectionner</button>
          </div>
        </div>
      </div>
    ) : null}
  </form>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
    <div className="grid gap-4 md:grid-cols-2">{children}</div>
  </section>;
}

function Input({ value, onChange, placeholder, helper, required = false, type = "text" }: { value: string; placeholder: string; helper?: string; required?: boolean; type?: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1"><input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />{helper ? <span className="text-xs text-slate-500">{helper}</span> : null}</label>;
}

function Select({ value, onChange, placeholder, items }: { value: string; placeholder: string; items: Ref[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
    <option value="">{placeholder}</option>
    {items.map((item) => <option key={`${item.id}-${item.name}`} value={item.id}>{item.name}</option>)}
  </select>;
}

function ImagePicker({ label, selected, onChange }: { label: string; selected: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
    {label}
    <input type="file" accept="image/*" onChange={(event) => void loadImage(event.target.files?.[0], onChange)} className="sr-only" />
    {selected ? <span className="text-xs font-normal text-green-600">Image sélectionnée</span> : <span className="text-xs font-normal text-slate-400">Choisir une image</span>}
  </label>;
}

function GalleryPicker({ selected, onChange }: { selected: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
    Ajouter des photos
    <input type="file" accept="image/*" multiple onChange={(event) => void loadImages(event.target.files, onChange)} className="sr-only" />
    {selected ? <span className="text-xs font-normal text-green-600">Galerie sélectionnée</span> : <span className="text-xs font-normal text-slate-400">Facultatif</span>}
  </label>;
}

function isNonStockVariant(variant: { model?: string | null; name?: string | null }) {
  return /sans suivi|non stock|non-stock|service|plat/i.test(`${variant.model ?? ""} ${variant.name ?? ""}`);
}

function loadImage(file: File | undefined, onDone: (value: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result));
  reader.readAsDataURL(file);
}

function loadImages(files: FileList | null, onDone: (value: string) => void) {
  const selected = Array.from(files ?? []);
  if (!selected.length) return;
  void Promise.all(selected.map((file) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  }))).then((values) => onDone(values.join("\n")));
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : body.message ?? "Opération impossible";
  } catch {
    return "Opération impossible";
  }
}

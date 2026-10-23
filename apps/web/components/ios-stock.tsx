"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronRight, History, Package, Search, SlidersHorizontal, X } from "lucide-react";

type StockItem = {
  id: string; productId: string; quantity: number; minimumStock: number; stockTracked?: boolean;
  product?: { name: string; sku: string; category?: { name?: string | null } | null; unit?: { name?: string | null; symbol?: string | null } | null } | null;
  warehouse?: { name: string } | null;
};

type Props<T extends StockItem> = {
  stocks: T[]; loading: boolean; error: string; message: string; query: string; onQuery: (value: string) => void;
  warehouses: { id: string; name: string }[]; warehouseId: string; onWarehouse: (value: string) => void;
  showNonStock: boolean; onNonStock: (value: boolean) => void; retry: () => void;
  tracked: (stock: T) => boolean; onAction: (stock: T, action: "in" | "out" | "adjust") => void; onTransfer: (stock: T) => void;
};

export function IosStock<T extends StockItem>(props: Props<T>) {
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);
  useEffect(() => {
    if (!selected) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", close); };
  }, [selected]);
  const status = (stock: T) => !props.tracked(stock) ? "untracked" : stock.quantity <= 0 ? "out" : stock.quantity <= Number(stock.minimumStock ?? 0) ? "low" : "available";
  const visible = props.stocks.filter(stock => filter === "all" || status(stock) === filter);
  const tracked = props.stocks.filter(props.tracked);
  const low = tracked.filter(stock => status(stock) === "low").length;
  const out = tracked.filter(stock => status(stock) === "out").length;
  const action = (kind: "in" | "out" | "adjust") => { if (selected) props.onAction(selected, kind); setSelected(null); };
  return <div className="vm-screen vm-stock">
    <div className="vm-title"><h1>Stock</h1><Link href="/dashboard/products/create" className="vm-round-action" aria-label="Ajouter un produit">+</Link></div>
    <div className="vm-stock-summary"><Package size={22}/><div><strong>{props.loading || props.error ? "—" : tracked.length}</strong><span>articles suivis</span></div><div><strong className={low ? "vm-amber" : ""}>{props.loading || props.error ? "—" : low}</strong><span>stock faible</span></div><div><strong className={out ? "vm-red" : ""}>{props.loading || props.error ? "—" : out}</strong><span>ruptures</span></div></div>
    <div className="vm-search-row"><label className="vm-search"><Search size={18}/><input aria-label="Rechercher dans le stock" value={props.query} onChange={event => props.onQuery(event.target.value)} placeholder="Rechercher un produit" /></label><button type="button" className="vm-filter-button" aria-label="Filtres du stock" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={19}/></button></div>
    {showFilters && <section className="vm-filter-panel"><label>Emplacement<select value={props.warehouseId} onChange={event => props.onWarehouse(event.target.value)}><option value="">Tous les emplacements</option>{props.warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="vm-check"><input type="checkbox" checked={props.showNonStock} onChange={event => props.onNonStock(event.target.checked)}/>Afficher les articles non suivis</label></section>}
    <nav className="vm-chips" aria-label="État du stock">{[{id:"all",label:"Tous"},{id:"low",label:"Stock faible"},{id:"out",label:"Ruptures"}].map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</nav>
    <div className="vm-section-heading"><h2>Mes produits</h2><Link href="/dashboard/products">Catalogue <ChevronRight size={14}/></Link></div>
    {props.error && <div role="alert" className="ios-notice">{props.error}<button onClick={props.retry}>Réessayer</button></div>}
    {props.message && <p role="status" className="vm-success">{props.message}</p>}
    {props.loading ? <div className="vm-state" role="status">Chargement du stock…</div> : !visible.length ? <div className="vm-state"><Package size={30}/><strong>{props.error ? "Stock indisponible" : "Aucun article à afficher"}</strong><p>{props.query || filter !== "all" ? "Essayez une autre recherche ou un autre filtre." : "Retrouvez ici les quantités de vos produits."}</p></div> : <div className="vm-stock-list">{visible.map(stock => <button type="button" className="vm-stock-item" key={stock.id} onClick={() => setSelected(stock)}><span className="vm-product-picture"><Package size={25}/></span><span className="vm-stock-name"><strong>{stock.product?.name || "Produit"}</strong><small>{stock.warehouse?.name || "Dépôt principal"}</small><span className={`vm-stock-badge vm-status-${status(stock)}`}>{status(stock) === "out" ? "Rupture" : status(stock) === "low" ? "Stock faible" : status(stock) === "untracked" ? "Non suivi" : "Disponible"}</span></span><span className="vm-stock-quantity"><strong>{props.tracked(stock) ? stock.quantity : "—"}</strong><small>{stock.product?.unit?.symbol || stock.product?.unit?.name || "unités"}</small></span><ChevronRight size={15}/></button>)}</div>}
    <Link className="vm-utility-link" href="/dashboard/inventory/movements"><History size={17}/>Historique des mouvements<ChevronRight size={16}/></Link>
    {selected && <div className="vm-sheet-overlay" onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="stock-actions-title" className="vm-sheet" onClick={event => event.stopPropagation()}><div className="vm-sheet-handle"/><button type="button" className="vm-sheet-close" aria-label="Fermer" onClick={() => setSelected(null)}><X size={20}/></button><h2 id="stock-actions-title">{selected.product?.name || "Produit"}</h2><p>{selected.warehouse?.name || "Dépôt principal"} · {selected.quantity} en stock</p>{props.tracked(selected) && <><button className="vm-action-row" onClick={() => action("in")}><ArrowDownLeft size={21}/>Entrée de stock<ChevronRight size={16}/></button><button className="vm-action-row" onClick={() => action("out")}><ArrowUpRight size={21}/>Sortie de stock<ChevronRight size={16}/></button><button className="vm-action-row" onClick={() => { props.onTransfer(selected); setSelected(null); }}><ArrowLeftRight size={21}/>Transférer<ChevronRight size={16}/></button></>}<Link className="vm-action-row" href={`/dashboard/inventory/movements?productId=${selected.productId}`}><History size={21}/>Voir l’historique<ChevronRight size={16}/></Link>{props.tracked(selected) && <details className="vm-advanced"><summary>Options avancées</summary><button onClick={() => action("adjust")}>Corriger après comptage</button></details>}</section></div>}
  </div>;
}

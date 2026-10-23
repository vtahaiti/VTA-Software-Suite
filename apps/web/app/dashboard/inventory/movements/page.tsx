"use client";
import { IosMovements } from "@/components/ios-movements";
import { useSearchParams } from "next/navigation";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";
import { useEffect,useState } from "react";
import { getAccessToken } from "@/lib/auth";
export default function MovementsPage() {
  const [items,setItems] = useState<any[]>([]);
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const params = useSearchParams();
  const productId = params.get("productId");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/movements`, { headers:{Authorization:`Bearer ${getAccessToken()}`} });
      if (!response.ok) throw new Error();
      setItems((await response.json()).items ?? []);
    } catch { setError("Impossible de charger les mouvements. Vérifiez la connexion."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = items.filter(item => (!productId || item.productId === productId || item.product?.id === productId) && (!search || item.product?.name?.toLowerCase().includes(search.toLowerCase()) || item.warehouse?.name?.toLowerCase().includes(search.toLowerCase())));
  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1") return <IosMovements items={filtered} search={search} onSearch={setSearch} loading={loading} error={error} retry={() => void load()} />;
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Mouvements</h1>{error && <p role="alert">{error}</p>}<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Recherche" className="w-full rounded-md border px-3 py-2 dark:bg-slate-950"/><div className="overflow-x-auto rounded-lg border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-slate-500">{["Produit","Entrepôt","Type","Quantité","Avant","Après"].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{filtered.map(item=><tr key={item.id} className="border-t dark:border-slate-800"><td className="p-3">{item.product?.name}</td><td className="p-3">{item.warehouse?.name}</td><td className="p-3">{item.type}</td><td className="p-3">{item.quantity}</td><td className="p-3">{item.beforeQty}</td><td className="p-3">{item.afterQty}</td></tr>)}</tbody></table></div></div>;
}

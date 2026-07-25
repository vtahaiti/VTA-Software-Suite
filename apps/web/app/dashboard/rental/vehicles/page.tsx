"use client";
import { apiBaseUrl as apiUrl } from "@/lib/api-url";

import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";

type Product = { id: string; name: string; sku: string; salePrice: number };
type Customer = { id: string; displayName: string; customerCode: string };
type Reservation = {
  id: string;
  status: "ACTIVE" | "RETURNED" | "CANCELLED";
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;
  rate: number;
  deposit: number;
  note: string | null;
  product: { id: string; name: string; sku: string };
  customer: { id: string; displayName: string };
};

export default function VehicleRentalPage() {
  const [vehicles, setVehicles] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [rate, setRate] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [note, setNote] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    const [p, c, r] = await Promise.all([
      fetchWithAuth(`${apiUrl}/products?limit=500`).catch(() => null),
      fetchWithAuth(`${apiUrl}/customers?limit=500`).catch(() => null),
      fetchWithAuth(`${apiUrl}/asset-reservations?assetType=VEHICLE`).catch(() => null)
    ]);
    if (p?.ok) setVehicles((await p.json()).items ?? []);
    if (c?.ok) setCustomers((await c.json()).items ?? []);
    if (r?.ok) setReservations(await r.json());
    setIsLoading(false);
  }

  const rentedVehicleIds = useMemo(() => new Set(reservations.filter((r) => r.status === "ACTIVE").map((r) => r.product.id)), [reservations]);
  const activeReservations = useMemo(() => reservations.filter((r) => r.status === "ACTIVE"), [reservations]);
  const history = useMemo(() => reservations.filter((r) => r.status !== "ACTIVE").slice(0, 20), [reservations]);
  const availableVehicles = vehicles.filter((vehicle) => !rentedVehicleIds.has(vehicle.id));

  function selectVehicle(id: string) {
    setProductId(id);
    const vehicle = vehicles.find((v) => v.id === id);
    if (vehicle) setRate(String(vehicle.salePrice ?? ""));
  }

  async function submit() {
    setError("");
    if (!productId) { setError("Sélectionnez un véhicule."); return; }
    if (!customerId) { setError("Sélectionnez un client."); return; }
    if (!expectedEndDate) { setError("Indiquez la date de retour prévue."); return; }

    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(`${apiUrl}/asset-reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId, customerId, assetType: "VEHICLE",
          expectedEndDate: new Date(expectedEndDate).toISOString(),
          rate: rate ? Number(rate) : undefined,
          deposit: deposit ? Number(deposit) : undefined,
          note: note || undefined
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message || "Location impossible.");
        return;
      }
      setProductId(""); setCustomerId(""); setExpectedEndDate(""); setRate(""); setDeposit("0"); setNote("");
      await load();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function returnVehicle(id: string) {
    setError("");
    const response = await fetchWithAuth(`${apiUrl}/asset-reservations/${id}/return`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!response.ok) { setError("Impossible d'enregistrer le retour."); return; }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Location de véhicules</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Véhicules</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Chaque véhicule est un produit du catalogue (SKU = plaque d&apos;immatriculation). Un véhicule ne peut avoir qu&apos;une seule location en cours à la fois.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}

      {!isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Véhicules disponibles</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{availableVehicles.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Véhicules en location</p>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{rentedVehicleIds.size}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Flotte totale</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{vehicles.length}</p>
          </div>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold text-slate-950 dark:text-white">Nouvelle location</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select value={productId} onChange={(event) => selectVehicle(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Véhicule disponible...</option>
              {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} ({vehicle.sku})</option>)}
            </select>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Client...</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} ({customer.customerCode})</option>)}
            </select>
            <div>
              <label className="text-xs font-semibold text-slate-500">Date de retour prévue</label>
              <input type="date" value={expectedEndDate} onChange={(event) => setExpectedEndDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Tarif / jour (HTG)</label>
              <input type="number" min="0" value={rate} onChange={(event) => setRate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Caution (HTG)</label>
              <input type="number" min="0" value={deposit} onChange={(event) => setDeposit(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note (optionnel)" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <button onClick={() => void submit()} disabled={isSubmitting} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Location..." : "Louer le véhicule"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-950 dark:text-white">Locations en cours</h2>
        </div>
        {activeReservations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr><th className="p-3 font-semibold">Véhicule</th><th className="p-3 font-semibold">Client</th><th className="p-3 font-semibold">Départ</th><th className="p-3 font-semibold">Retour prévu</th><th className="p-3 font-semibold">Tarif/jour</th><th className="p-3 font-semibold"></th></tr>
              </thead>
              <tbody>
                {activeReservations.map((reservation) => (
                  <tr key={reservation.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{reservation.product.name}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.customer.displayName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{new Date(reservation.startDate).toLocaleDateString("fr-HT")}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{new Date(reservation.expectedEndDate).toLocaleDateString("fr-HT")}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.rate}</td>
                    <td className="p-3"><button onClick={() => void returnVehicle(reservation.id)} className="rounded-md border px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Marquer retourné</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Aucune location en cours.</div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-950 dark:text-white">Historique récent</h2>
        </div>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr><th className="p-3 font-semibold">Véhicule</th><th className="p-3 font-semibold">Client</th><th className="p-3 font-semibold">Retour réel</th><th className="p-3 font-semibold">Statut</th></tr>
              </thead>
              <tbody>
                {history.map((reservation) => (
                  <tr key={reservation.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.product.name}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.customer.displayName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.actualEndDate ? new Date(reservation.actualEndDate).toLocaleDateString("fr-HT") : "--"}</td>
                    <td className="p-3 text-xs text-slate-500">{reservation.status === "RETURNED" ? "Terminé" : "Annulé"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Aucun historique pour le moment.</div>
        )}
      </div>
    </div>
  );
}

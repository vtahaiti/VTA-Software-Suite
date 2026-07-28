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

export default function HotelRoomsPage() {
  const [rooms, setRooms] = useState<Product[]>([]);
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
    setError("");
    try {
      const [productsResponse, customersResponse, reservationsResponse] = await Promise.all([
        fetchWithAuth(`${apiUrl}/products?limit=100`).catch(() => null),
        fetchWithAuth(`${apiUrl}/customers?limit=100`).catch(() => null),
        fetchWithAuth(`${apiUrl}/asset-reservations?assetType=ROOM`).catch(() => null)
      ]);

      const failures: string[] = [];
      if (productsResponse?.ok) setRooms((await productsResponse.json()).items ?? []);
      else {
        setRooms([]);
        failures.push("les chambres");
      }
      if (customersResponse?.ok) setCustomers((await customersResponse.json()).items ?? []);
      else {
        setCustomers([]);
        failures.push("les clients");
      }
      if (reservationsResponse?.ok) setReservations(await reservationsResponse.json());
      else {
        setReservations([]);
        failures.push("les réservations");
      }
      if (failures.length) {
        setError(`Impossible de charger ${failures.join(", ")}. Vérifiez votre connexion puis réessayez.`);
      }
    } catch {
      setRooms([]);
      setCustomers([]);
      setReservations([]);
      setError("Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setIsLoading(false);
    }
  }

  const occupiedRoomIds = useMemo(() => new Set(reservations.filter((r) => r.status === "ACTIVE").map((r) => r.product.id)), [reservations]);
  const activeReservations = useMemo(() => reservations.filter((r) => r.status === "ACTIVE"), [reservations]);
  const history = useMemo(() => reservations.filter((r) => r.status !== "ACTIVE").slice(0, 20), [reservations]);
  const availableRooms = rooms.filter((room) => !occupiedRoomIds.has(room.id));

  function selectRoom(id: string) {
    setProductId(id);
    const room = rooms.find((r) => r.id === id);
    if (room) setRate(String(room.salePrice ?? ""));
  }

  async function submit() {
    setError("");
    if (!productId) { setError("Sélectionnez une chambre."); return; }
    if (!customerId) { setError("Sélectionnez un client."); return; }
    if (!expectedEndDate) { setError("Indiquez la date de départ prévue."); return; }

    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(`${apiUrl}/asset-reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId, customerId, assetType: "ROOM",
          expectedEndDate: new Date(expectedEndDate).toISOString(),
          rate: rate ? Number(rate) : undefined,
          deposit: deposit ? Number(deposit) : undefined,
          note: note || undefined
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message || "Réservation impossible.");
        return;
      }
      setProductId(""); setCustomerId(""); setExpectedEndDate(""); setRate(""); setDeposit("0"); setNote("");
      await load();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkout(id: string) {
    setError("");
    const response = await fetchWithAuth(`${apiUrl}/asset-reservations/${id}/return`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!response.ok) { setError("Impossible d'enregistrer le départ."); return; }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Hôtel</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Réservations & Chambres</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Chaque chambre est un produit du catalogue (SKU = numéro de chambre). Une chambre ne peut avoir qu&apos;un seul séjour en cours à la fois.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}

      {!isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chambres disponibles</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{availableRooms.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chambres occupées</p>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{occupiedRoomIds.size}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total chambres</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{rooms.length}</p>
          </div>
        </div>
      ) : null}

      {!isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold text-slate-950 dark:text-white">Nouvelle réservation</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select value={productId} onChange={(event) => selectRoom(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Chambre disponible...</option>
              {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} ({room.sku})</option>)}
            </select>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Client...</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} ({customer.customerCode})</option>)}
            </select>
            <div>
              <label className="text-xs font-semibold text-slate-500">Date de départ prévue</label>
              <input type="date" value={expectedEndDate} onChange={(event) => setExpectedEndDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Tarif / nuit (HTG)</label>
              <input type="number" min="0" value={rate} onChange={(event) => setRate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Caution (HTG)</label>
              <input type="number" min="0" value={deposit} onChange={(event) => setDeposit(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            </div>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note (optionnel)" className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <button onClick={() => void submit()} disabled={isSubmitting} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Réservation..." : "Réserver la chambre"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Chargement...</div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-950 dark:text-white">Séjours en cours</h2>
        </div>
        {activeReservations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr><th className="p-3 font-semibold">Chambre</th><th className="p-3 font-semibold">Client</th><th className="p-3 font-semibold">Arrivée</th><th className="p-3 font-semibold">Départ prévu</th><th className="p-3 font-semibold">Tarif/nuit</th><th className="p-3 font-semibold"></th></tr>
              </thead>
              <tbody>
                {activeReservations.map((reservation) => (
                  <tr key={reservation.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{reservation.product.name}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.customer.displayName}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{new Date(reservation.startDate).toLocaleDateString("fr-HT")}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{new Date(reservation.expectedEndDate).toLocaleDateString("fr-HT")}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{reservation.rate}</td>
                    <td className="p-3"><button onClick={() => void checkout(reservation.id)} className="rounded-md border px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Enregistrer le départ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Aucun séjour en cours.</div>
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
                <tr><th className="p-3 font-semibold">Chambre</th><th className="p-3 font-semibold">Client</th><th className="p-3 font-semibold">Départ réel</th><th className="p-3 font-semibold">Statut</th></tr>
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

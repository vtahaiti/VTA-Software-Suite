"use client";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { fetchWithAuth } from "./api-client";
import { apiBaseUrl } from "./api-url";

export type AppleTransaction = { transactionId: string; signedTransaction: string; appAccountToken: string };
export const AppleSubscriptions = registerPlugin<{
  products(): Promise<{ products: Array<{ id: string; name: string; price: string }> }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<{ status: "purchased" | "pending" | "cancelled"; transaction?: AppleTransaction }>;
  pending(): Promise<{ transactions: AppleTransaction[] }>;
  restore(): Promise<{ transactions: AppleTransaction[] }>;
  finish(options: { transactionId: string }): Promise<void>;
  manage(): Promise<void>;
  addListener(event: "transactionUpdated" | "purchaseIntent", listener: () => void): Promise<PluginListenerHandle>;
}>("VtaSubscriptions");

export class SubscriptionRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function subscriptionRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetchWithAuth(`${apiBaseUrl}/subscription/${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal
  } : { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new SubscriptionRequestError(Array.isArray(payload.message) ? payload.message[0] : payload.message ?? "Abonnement indisponible. Réessayez.", response.status);
  return payload;
}

export async function confirmAppleTransaction(transaction: AppleTransaction, accountToken: string) {
  if (transaction.appAccountToken.toLowerCase() !== accountToken.toLowerCase()) throw new Error("Cet achat appartient à une autre entreprise. Connectez-vous au compte associé.");
  await subscriptionRequest("apple/verify", { signedTransaction: transaction.signedTransaction });
  // If the server is unavailable, leave the purchase unfinished for the next retry.
  await AppleSubscriptions.finish({ transactionId: transaction.transactionId });
}

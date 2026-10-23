export function addOfflineProduct<T extends { productId?: string | null; quantity: number }>(items: T[], productId: string, quantity = 1): T[] {
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Produit ou quantité invalide.");
  const existing = items.find(item => item.productId === productId);
  return existing ? items.map(item => item === existing ? { ...item, quantity: item.quantity + quantity } : item)
    : [...items, { productId, quantity } as T];
}

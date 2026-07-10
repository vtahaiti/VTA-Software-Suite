import { Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export type StockSnapshot = {
  productId?: string | null;
  quantity: number;
  reserved?: number | null;
  minimumStock?: number | null;
  product?: ProductCostSnapshot & { minimumStock?: DecimalLike };
};

export type ProductCostSnapshot = {
  purchasePrice?: DecimalLike;
  averageCost?: DecimalLike;
};

export function numeric(value: DecimalLike) {
  return Number(value ?? 0);
}

export function availableStock(stock: StockSnapshot) {
  return numeric(stock.quantity) - numeric(stock.reserved);
}

export function isLowStock(stock: StockSnapshot) {
  return availableStock(stock) <= numeric(stock.minimumStock);
}

export function isOutOfStock(stock: StockSnapshot) {
  return availableStock(stock) <= 0;
}

export function knownUnitCost(product: ProductCostSnapshot) {
  const averageCost = numeric(product.averageCost);
  if (averageCost > 0) return { known: true, amount: averageCost, source: "averageCost" as const };

  const purchasePrice = numeric(product.purchasePrice);
  if (purchasePrice > 0) return { known: true, amount: purchasePrice, source: "purchasePrice" as const };

  return { known: false, amount: null, source: null };
}

export function stockValue(stock: StockSnapshot, product: ProductCostSnapshot) {
  const cost = knownUnitCost(product);
  if (!cost.known || cost.amount === null) return null;
  return availableStock(stock) * cost.amount;
}

export function sumKnownStockValue(stocks: Array<StockSnapshot & { product: ProductCostSnapshot }>) {
  return stocks.reduce((sum, stock) => sum + (stockValue(stock, stock.product) ?? 0), 0);
}

export function countUnknownCostStocks(stocks: Array<StockSnapshot & { product: ProductCostSnapshot }>) {
  return stocks.filter((stock) => availableStock(stock) > 0 && !knownUnitCost(stock.product).known).length;
}

export function stockThreshold(stock: StockSnapshot) {
  return numeric(stock.minimumStock ?? stock.product?.minimumStock);
}

export function isLowStockProduct(productStock: { available: number; minimumStock: number }) {
  return productStock.available <= productStock.minimumStock;
}

export function summarizeStockByProduct(stocks: StockSnapshot[]) {
  const products = new Map<string, { productId: string; available: number; quantity: number; reserved: number; minimumStock: number }>();
  for (const stock of stocks) {
    const productId = stock.productId ?? "unknown";
    const current = products.get(productId) ?? { productId, available: 0, quantity: 0, reserved: 0, minimumStock: 0 };
    current.quantity += numeric(stock.quantity);
    current.reserved += numeric(stock.reserved);
    current.available += availableStock(stock);
    current.minimumStock = Math.max(current.minimumStock, stockThreshold(stock));
    products.set(productId, current);
  }
  return Array.from(products.values());
}

export function countLowStockProducts(stocks: StockSnapshot[]) {
  return summarizeStockByProduct(stocks).filter(isLowStockProduct).length;
}

export function countOutOfStockProducts(stocks: StockSnapshot[]) {
  return summarizeStockByProduct(stocks).filter((stock) => stock.available <= 0).length;
}

export function countUnknownCostProducts(stocks: Array<StockSnapshot & { product: ProductCostSnapshot }>) {
  const products = new Map<string, { available: number; costKnown: boolean }>();
  for (const stock of stocks) {
    const productId = stock.productId ?? "unknown";
    const current = products.get(productId) ?? { available: 0, costKnown: knownUnitCost(stock.product).known };
    current.available += availableStock(stock);
    current.costKnown = current.costKnown || knownUnitCost(stock.product).known;
    products.set(productId, current);
  }
  return Array.from(products.values()).filter((product) => product.available > 0 && !product.costKnown).length;
}

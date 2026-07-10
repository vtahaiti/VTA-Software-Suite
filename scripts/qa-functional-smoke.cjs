const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || "http://localhost:3001";
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || "admin@vta.ht";
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || "admin123";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message || payload || response.statusText;
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
  }
  return payload;
}

async function getStock(tenantId, productId, warehouseId) {
  const stock = await prisma.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId } } });
  return stock?.quantity ?? 0;
}

async function ensureOpenCashSession(token, suffix) {
  try {
    return await request("/cash-registers/sessions/active", { token });
  } catch (error) {
    const registers = await request("/cash-registers", { token });
    const register = registers[0] || await request("/cash-registers", {
      method: "POST",
      token,
      body: { name: `Caisse QA ${suffix}`, code: `QA-${suffix}`.slice(0, 24), isActive: true }
    });
    return request("/cash-registers/sessions/open", {
      method: "POST",
      token,
      body: { cashRegisterId: register.id, openingAmount: 0 }
    });
  }
}

async function main() {
  const suffix = Date.now().toString(36);
  const health = await request("/health");
  assert(health.status === "ok", "API health KO");

  const login = await request("/auth/login", { method: "POST", body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rememberMe: true } });
  const token = login.accessToken;
  assert(token, "Token JWT absent apres login");

  const admin = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL }, include: { tenant: true } });
  assert(admin?.tenantId, "Utilisateur admin introuvable en base");
  const tenantId = admin.tenantId;
  const warehouse = await prisma.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } });
  assert(warehouse, "Aucun depot actif pour le tenant admin");
  const storeId = warehouse.storeId || undefined;
  const cashSession = await ensureOpenCashSession(token, suffix);
  assert(cashSession.id, "Session de caisse ouverte introuvable");

  const customer = await request("/customers", {
    method: "POST",
    token,
    body: { displayName: `Client QA ${suffix}`, phone: "50936000000", address: "Rue QA", email: `client-${suffix}@qa.local`, notes: "Smoke QA" }
  });
  assert(customer.id, "Client non cree");
  const updatedCustomer = await request(`/customers/${customer.id}`, { method: "PATCH", token, body: { address: "Rue QA modifiee", notes: "Smoke QA modifie" } });
  assert(updatedCustomer.address === "Rue QA modifiee", "Modification client non persistante");
  await request(`/customers/${customer.id}`, { method: "DELETE", token });

  const supplier = await request("/suppliers", {
    method: "POST",
    token,
    body: { name: `Fournisseur QA ${suffix}`, phone: "50937000000", address: "Depot QA", email: `supplier-${suffix}@qa.local` }
  });
  assert(supplier.id, "Fournisseur non cree");
  const updatedSupplier = await request(`/suppliers/${supplier.id}`, { method: "PATCH", token, body: { address: "Depot QA modifie" } });
  assert(updatedSupplier.address === "Depot QA modifie", "Modification fournisseur non persistante");

  const product = await request("/products", {
    method: "POST",
    token,
    body: { name: `Produit QA ${suffix}`, salePrice: 100, purchasePrice: 60, minimumStock: 2, stockInitial: 5, warehouseId: warehouse.id, isActive: true }
  });
  assert(product.id, "Produit non cree");
  assert(product.stockCurrent === 5, `Stock initial attendu 5, recu ${product.stockCurrent}`);
  assert(await getStock(tenantId, product.id, warehouse.id) === 5, "Stock initial non cree en base");

  const updatedProduct = await request(`/products/${product.id}`, { method: "PATCH", token, body: { salePrice: 110, minimumStock: 1 } });
  assert(Number(updatedProduct.salePrice) === 110, "Modification prix produit non persistante");

  const purchaseOrder = await request("/purchase-orders", {
    method: "POST",
    token,
    body: { supplierId: supplier.id, storeId, warehouseId: warehouse.id, notes: "Commande QA", items: [{ productId: product.id, quantity: 2, unitCost: 60 }] }
  });
  assert(purchaseOrder.items?.[0]?.id, "Ligne achat non creee");
  await request(`/purchase-orders/${purchaseOrder.id}/approve`, { method: "POST", token });
  await request("/goods-receipts", {
    method: "POST",
    token,
    body: { purchaseOrderId: purchaseOrder.id, warehouseId: warehouse.id, notes: "Reception QA", items: [{ purchaseOrderItemId: purchaseOrder.items[0].id, quantity: 2 }] }
  });
  assert(await getStock(tenantId, product.id, warehouse.id) === 7, "Achat +2 doit donner stock 7");

  const cart = await request("/pos/cart/calculate", {
    method: "POST",
    token,
    body: { warehouseId: warehouse.id, items: [{ productId: product.id, quantity: 3 }], taxRate: 0, discount: 0 }
  });
  assert(cart.canCheckout === true && cart.total === 330, "Calcul panier POS invalide");

  const saleExact = await request("/pos/checkout", {
    method: "POST",
    token,
    body: { warehouseId: warehouse.id, storeId, cashSessionId: cashSession.id, items: [{ productId: product.id, quantity: 3 }], payments: [{ method: "CASH", amount: 330 }] }
  });
  assert(saleExact.id && Number(saleExact.invoice?.balance ?? -1) === 0, "Vente paiement exact invalide");
  assert(await getStock(tenantId, product.id, warehouse.id) === 4, "Vente de 3 depuis 7 doit donner stock 4");

  const saleOverpaid = await request("/pos/checkout", {
    method: "POST",
    token,
    body: { warehouseId: warehouse.id, storeId, cashSessionId: cashSession.id, items: [{ productId: product.id, quantity: 1 }], payments: [{ method: "CASH", amount: 120 }] }
  });
  assert(Number(saleOverpaid.invoice?.paidAmount ?? 0) === 120, "Paiement superieur non enregistre");

  const salePartial = await request("/pos/checkout", {
    method: "POST",
    token,
    body: { warehouseId: warehouse.id, storeId, cashSessionId: cashSession.id, items: [{ productId: product.id, quantity: 1 }], payments: [{ method: "CASH", amount: 40 }] }
  });
  assert(Number(salePartial.invoice?.balance ?? 0) === 70, "Balance paiement partiel invalide");

  let insufficientBlocked = false;
  try {
    await request("/pos/checkout", {
      method: "POST",
      token,
      body: { warehouseId: warehouse.id, storeId, cashSessionId: cashSession.id, items: [{ productId: product.id, quantity: 10 }], payments: [{ method: "CASH", amount: 1100 }] }
    });
  } catch (error) {
    insufficientBlocked = String(error.message).includes("Stock insuffisant");
  }
  assert(insufficientBlocked, "Stock insuffisant non bloque");

  await request(`/sales/${salePartial.id}/return`, { method: "POST", token, body: { warehouseId: warehouse.id } });
  assert(await getStock(tenantId, product.id, warehouse.id) === 3, "Retour produit doit augmenter le stock");

  await request(`/sales/${saleOverpaid.id}/cancel`, { method: "POST", token });
  assert(await getStock(tenantId, product.id, warehouse.id) === 4, "Annulation vente doit restaurer le stock");

  const saleList = await request("/sales?page=1&limit=5", { token });
  assert((saleList.items || []).some((sale) => sale.id === saleExact.id), "Vente absente de l'historique");

  const reports = await request("/reports/dashboard", { token });
  assert(Number(reports.sales?.summary?.total ?? 0) >= 0, "Rapport dashboard ventes invalide");
  const dashboard = await request("/dashboard/summary", { token });
  assert(Array.isArray(dashboard.salesLast30Days) && dashboard.salesLast30Days.length === 30, "Graphique 30 jours absent");

  const movementTypes = await prisma.inventoryMovement.findMany({ where: { tenantId, productId: product.id }, select: { type: true } });
  const types = new Set(movementTypes.map((movement) => movement.type));
  for (const type of ["PURCHASE", "SALE", "RETURN", "CANCEL_SALE"]) assert(types.has(type), `Mouvement ${type} manquant`);

  await request(`/suppliers/${supplier.id}/deactivate`, { method: "POST", token });
  await request(`/products/${product.id}`, { method: "PATCH", token, body: { isActive: false } });

  console.log(JSON.stringify({
    status: "QA_FUNCTIONAL_SMOKE_OK",
    tenant: admin.tenant.name,
    stockFinal: await getStock(tenantId, product.id, warehouse.id),
    customerCrud: "ok",
    supplierCrud: "ok",
    productCrud: "ok",
    purchaseReceipt: "ok",
    posExact: "ok",
    posOverpaid: "ok",
    posPartial: "ok",
    insufficientStock: "blocked",
    returnStock: "ok",
    cancelSale: "ok",
    reports: "ok"
  }, null, 2));
}

main().catch((error) => {
  console.error("QA_FUNCTIONAL_SMOKE_FAILED", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});

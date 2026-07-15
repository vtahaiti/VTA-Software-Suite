import { Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";

type ExportFormat = "csv" | "xlsx";
type ExportResult = { content: string | Buffer; contentType: string; fileName: string };

const productTemplateRows = [
  {
    "Code / SKU": "SKU-001",
    "Produit / Nom": "Exemple produit",
    "Catégorie": "Catégorie exemple",
    "Stock / Quantité": 10,
    "Unité": "sac",
    "Référence fournisseur": "REF-FOURN-001",
    "Dimensions": "2x4",
    "Couleur": "",
    "Épaisseur": "",
    "Longueur": "",
    "Type / Matériau": "ciment",
    "Prix d'achat": 100,
    "Prix de vente": 150,
    "Stock faible / Stock minimum": 5,
    "Code-barres": "",
    "Fournisseur": ""
  }
];

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  productTemplate(format: ExportFormat) {
    return this.format(productTemplateRows, format, "modele-import-produits");
  }

  async products(tenantId: string, format: ExportFormat) {
    const products = await this.prisma.product.findMany({ where: { tenantId }, include: { category: true, brand: true, unit: true, supplier: true, barcodes: true, variants: true }, orderBy: { name: "asc" } });
    const rows = products.map((product) => ({
      "Code / SKU": product.sku,
      "Produit": product.name,
      "Référence fournisseur": product.reference ?? "",
      "Code-barres": product.barcodes[0]?.value ?? "",
      "Catégorie": product.category?.name ?? "",
      "Marque": product.brand?.name ?? "",
      "Fournisseur": product.supplier?.name ?? "",
      "Unité": product.unit?.symbol ?? "",
      "Dimensions": product.variants[0]?.size ?? "",
      "Couleur": product.variants[0]?.color ?? "",
      "Épaisseur / Longueur": product.variants[0]?.capacity ?? "",
      "Type / Matériau": product.variants[0]?.model ?? "",
      "Prix d'achat": this.decimal(product.purchasePrice),
      "Prix de vente": this.decimal(product.salePrice),
      "Stock minimum": product.minimumStock,
      "Statut": product.isActive ? "Actif" : "Inactif"
    }));
    return this.format(rows, format, "produits");
  }

  async customers(tenantId: string, format: ExportFormat) {
    const customers = await this.prisma.customer.findMany({ where: { tenantId }, orderBy: { displayName: "asc" } });
    const rows = customers.map((customer) => ({
      "Code": customer.customerCode,
      "Nom": customer.displayName,
      "Entreprise": customer.company ?? "",
      "Téléphone": customer.phone ?? "",
      "Mobile": customer.mobile ?? "",
      "WhatsApp": customer.whatsapp ?? "",
      "Email": customer.email ?? "",
      "Ville": customer.city ?? "",
      "Solde": this.decimal(customer.currentBalance),
      "Statut": customer.status
    }));
    return this.format(rows, format, "clients");
  }

  async suppliers(tenantId: string, format: ExportFormat) {
    const suppliers = await this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
    const rows = suppliers.map((supplier) => ({
      "Code": supplier.code,
      "Nom": supplier.name,
      "Téléphone": supplier.phone ?? "",
      "WhatsApp": supplier.whatsapp ?? "",
      "Email": supplier.email ?? "",
      "Contact principal": supplier.primaryContact ?? "",
      "Solde": this.decimal(supplier.balance),
      "Statut": supplier.status
    }));
    return this.format(rows, format, "fournisseurs");
  }

  async stock(tenantId: string, format: ExportFormat) {
    const stocks = await this.prisma.stock.findMany({ where: { tenantId }, include: { product: { include: { unit: true, supplier: true } }, warehouse: true }, orderBy: { updatedAt: "desc" } });
    const rows = stocks.map((stock) => {
      const available = stock.quantity - stock.reserved;
      const threshold = stock.minimumStock || stock.product.minimumStock;
      return {
        "Code / SKU": stock.product.sku,
        "Produit": stock.product.name,
        "Unité": stock.product.unit?.symbol ?? "",
        "Fournisseur": stock.product.supplier?.name ?? "",
        "Dépôt": stock.warehouse.name,
        "Quantité": stock.quantity,
        "Réservé": stock.reserved,
        "Disponible": available,
        "Stock minimum": threshold,
        "Stock faible": available <= threshold ? "Oui" : "Non"
      };
    });
    return this.format(rows, format, "stock");
  }

  async movements(tenantId: string, format: ExportFormat) {
    const movements = await this.prisma.inventoryMovement.findMany({ where: { tenantId }, include: { product: { include: { unit: true, supplier: true } }, warehouse: true }, orderBy: { createdAt: "desc" }, take: 5000 });
    const rows = movements.map((movement) => ({
      "Date": movement.createdAt,
      "Code / SKU": movement.product.sku,
      "Produit": movement.product.name,
      "Dépôt": movement.warehouse.name,
      "Type": movement.type,
      "Quantité": movement.quantity,
      "Avant": movement.beforeQty,
      "Après": movement.afterQty,
      "Référence": movement.reference ?? "",
      "Note": movement.note ?? ""
    }));
    return this.format(rows, format, "mouvements-inventaire");
  }

  async lowStock(tenantId: string, format: ExportFormat) {
    const stocks = await this.prisma.stock.findMany({ where: { tenantId }, include: { product: { include: { unit: true, supplier: true } }, warehouse: true }, orderBy: { updatedAt: "desc" } });
    const rows = stocks.filter((stock) => (stock.quantity - stock.reserved) <= (stock.minimumStock || stock.product.minimumStock)).map((stock) => {
      const available = stock.quantity - stock.reserved;
      const threshold = stock.minimumStock || stock.product.minimumStock;
      return {
        "Code / SKU": stock.product.sku,
        "Produit": stock.product.name,
        "Unité": stock.product.unit?.symbol ?? "",
        "Fournisseur": stock.product.supplier?.name ?? "",
        "Dépôt": stock.warehouse.name,
        "Disponible": available,
        "Stock minimum": threshold,
        "Manquant": Math.max(threshold - available, 0)
      };
    });
    return this.format(rows, format, "alertes-stock-faible");
  }

  async sales(tenantId: string, format: ExportFormat) {
    const sales = await this.prisma.sale.findMany({ where: { tenantId }, include: { customer: true, payments: true, receipt: true }, orderBy: { createdAt: "desc" }, take: 10000 });
    const rows = sales.map((sale) => ({
      "Date": sale.createdAt,
      "Reçu": sale.receipt?.number ?? sale.id,
      "Client": sale.customer?.displayName ?? "Client comptoir",
      "Statut": sale.status,
      "Sous-total": this.decimal(sale.subtotal),
      "Remise": this.decimal(sale.discount),
      "Taxe": this.decimal(sale.tax),
      "Total": this.decimal(sale.total),
      "Montant réglé": this.decimal(sale.payments.reduce((sum, payment) => sum + this.decimal(payment.amount), 0)),
      "Montant reçu": this.decimal(sale.payments.reduce((sum, payment) => sum + this.decimal(payment.receivedAmount ?? payment.amount), 0)),
      "Monnaie": this.decimal(sale.payments.reduce((sum, payment) => sum + this.decimal(payment.changeAmount), 0)),
      "Paiements": sale.payments.length
    }));
    return this.format(rows, format, "ventes");
  }

  async purchases(tenantId: string, format: ExportFormat) {
    const purchases = await this.prisma.purchaseOrder.findMany({ where: { tenantId }, include: { supplier: true }, orderBy: { createdAt: "desc" }, take: 10000 });
    const rows = purchases.map((purchase) => ({
      "Date": purchase.createdAt,
      "Numéro": purchase.number,
      "Fournisseur": purchase.supplier.name,
      "Statut": purchase.status,
      "Sous-total": this.decimal(purchase.subtotal),
      "Remise": this.decimal(purchase.discount),
      "Taxe": this.decimal(purchase.tax),
      "Total": this.decimal(purchase.total)
    }));
    return this.format(rows, format, "achats");
  }

  async reportSummary(tenantId: string, format: ExportFormat) {
    const [products, customers, suppliers, sales, purchases, lowStock] = await Promise.all([
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.supplier.count({ where: { tenantId } }),
      this.prisma.sale.count({ where: { tenantId } }),
      this.prisma.purchaseOrder.count({ where: { tenantId } }),
      this.prisma.stock.count({ where: { tenantId, quantity: { lte: 0 } } })
    ]);
    return this.format([{ "Produits": products, "Clients": customers, "Fournisseurs": suppliers, "Ventes": sales, "Achats": purchases, "Stocks à vérifier": lowStock }], format, "rapport-synthese");
  }

  private format(rows: Array<Record<string, unknown>>, format: ExportFormat, name: string): ExportResult {
    if (format === "xlsx") return { content: this.toXlsx(rows, name), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName: `${name}.xlsx` };
    return { content: this.toCsv(rows), contentType: "text/csv; charset=utf-8", fileName: `${name}.csv` };
  }

  private toCsv(rows: Array<Record<string, unknown>>) {
    const dataRows = rows.length ? rows : [{ "Message": "Aucune donnée" }];
    const headers = Object.keys(dataRows[0]);
    return "\uFEFF" + [headers, ...dataRows.map((row) => headers.map((header) => this.csvValue(row[header])))].map((row) => row.join(";")).join("\n");
  }

  private toXlsx(rows: Array<Record<string, unknown>>, title: string) {
    const dataRows = rows.length ? rows : [{ "Message": "Aucune donnée" }];
    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    worksheet["!cols"] = Object.keys(dataRows[0]).map((key) => ({ wch: Math.max(14, key.length + 2) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
    return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  }

  private csvValue(value: unknown) {
    const raw = value instanceof Date ? value.toISOString() : String(value ?? "");
    const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${protectedValue.replace(/"/g, '""')}"`;
  }

  private decimal(value: unknown) {
    if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") return (value as { toNumber: () => number }).toNumber();
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
  }
}


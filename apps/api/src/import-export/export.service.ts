import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type ExportFormat = "csv" | "excel";
type ExportResult = { content: string; contentType: string; fileName: string };

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async products(tenantId: string, format: ExportFormat) {
    const products = await this.prisma.product.findMany({ where: { tenantId }, include: { category: true, brand: true, unit: true, barcodes: true }, orderBy: { name: "asc" } });
    const rows = products.map((product) => ({ sku: product.sku, name: product.name, barcode: product.barcodes[0]?.value ?? "", category: product.category?.name ?? "", brand: product.brand?.name ?? "", unit: product.unit?.symbol ?? "", purchasePrice: product.purchasePrice, salePrice: product.salePrice, minimumStock: product.minimumStock, status: product.isActive ? "Actif" : "Inactif" }));
    return this.format(rows, format, "produits");
  }

  async customers(tenantId: string, format: ExportFormat) {
    const customers = await this.prisma.customer.findMany({ where: { tenantId }, orderBy: { displayName: "asc" } });
    const rows = customers.map((customer) => ({ code: customer.customerCode, name: customer.displayName, company: customer.company ?? "", phone: customer.phone ?? "", mobile: customer.mobile ?? "", whatsapp: customer.whatsapp ?? "", email: customer.email ?? "", city: customer.city ?? "", balance: customer.currentBalance, status: customer.status }));
    return this.format(rows, format, "clients");
  }

  async suppliers(tenantId: string, format: ExportFormat) {
    const suppliers = await this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
    const rows = suppliers.map((supplier) => ({ code: supplier.code, name: supplier.name, phone: supplier.phone ?? "", whatsapp: supplier.whatsapp ?? "", email: supplier.email ?? "", primaryContact: supplier.primaryContact ?? "", balance: supplier.balance, status: supplier.status }));
    return this.format(rows, format, "fournisseurs");
  }

  async stock(tenantId: string, format: ExportFormat) {
    const stocks = await this.prisma.stock.findMany({ where: { tenantId }, include: { product: true, warehouse: true }, orderBy: { updatedAt: "desc" } });
    const rows = stocks.map((stock) => ({ sku: stock.product.sku, product: stock.product.name, warehouse: stock.warehouse.name, quantity: stock.quantity, reserved: stock.reserved, available: stock.quantity - stock.reserved, minimumStock: stock.minimumStock || stock.product.minimumStock, lowStock: stock.quantity <= (stock.minimumStock || stock.product.minimumStock) ? "Oui" : "Non" }));
    return this.format(rows, format, "stock");
  }

  async movements(tenantId: string, format: ExportFormat) {
    const movements = await this.prisma.inventoryMovement.findMany({ where: { tenantId }, include: { product: true, warehouse: true }, orderBy: { createdAt: "desc" }, take: 5000 });
    const rows = movements.map((movement) => ({ date: movement.createdAt.toISOString(), sku: movement.product.sku, product: movement.product.name, warehouse: movement.warehouse.name, type: movement.type, quantity: movement.quantity, beforeQty: movement.beforeQty, afterQty: movement.afterQty, reference: movement.reference ?? "", note: movement.note ?? "" }));
    return this.format(rows, format, "mouvements-inventaire");
  }

  async lowStock(tenantId: string, format: ExportFormat) {
    const stocks = await this.prisma.stock.findMany({ where: { tenantId }, include: { product: true, warehouse: true }, orderBy: { updatedAt: "desc" } });
    const rows = stocks.filter((stock) => stock.quantity <= (stock.minimumStock || stock.product.minimumStock)).map((stock) => ({ sku: stock.product.sku, product: stock.product.name, warehouse: stock.warehouse.name, quantity: stock.quantity, minimumStock: stock.minimumStock || stock.product.minimumStock, missing: Math.max((stock.minimumStock || stock.product.minimumStock) - stock.quantity, 0) }));
    return this.format(rows, format, "alertes-stock-faible");
  }

  private format(rows: Array<Record<string, unknown>>, format: ExportFormat, name: string): ExportResult {
    if (format === "excel") return { content: this.toExcel(rows, name), contentType: "application/vnd.ms-excel; charset=utf-8", fileName: `${name}.xls` };
    return { content: this.toCsv(rows), contentType: "text/csv; charset=utf-8", fileName: `${name}.csv` };
  }

  private toCsv(rows: Array<Record<string, unknown>>) {
    const headers = rows[0] ? Object.keys(rows[0]) : ["message"];
    const dataRows = rows.length ? rows : [{ message: "Aucune donnee" }];
    return [headers, ...dataRows.map((row) => headers.map((header) => row[header] ?? ""))].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  private toExcel(rows: Array<Record<string, unknown>>, title: string) {
    const headers = rows[0] ? Object.keys(rows[0]) : ["message"];
    const dataRows = rows.length ? rows : [{ message: "Aucune donnee" }];
    const th = headers.map((header) => `<th>${this.escapeHtml(header)}</th>`).join("");
    const body = dataRows.map((row) => `<tr>${headers.map((header) => `<td>${this.escapeHtml(row[header])}</td>`).join("")}</tr>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:6px}th{background:#eef2ff}</style></head><body><h1>${this.escapeHtml(title)}</h1><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }

  private escapeHtml(value: unknown) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
}
import { BadRequestException, Injectable } from "@nestjs/common";
import { BarcodeType, CustomerStatus, CustomerType, SupplierStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ImportEntity = "products" | "customers" | "suppliers";
type CsvRecord = Record<string, string>;
type ImportError = { line: number; field?: string; message: string; value?: string };
type ImportSuccess = { line: number; id: string; label: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importProducts(tenantId: string, content: string) {
    const parsed = this.parseCsv(content, ["name"]);
    return this.importRows("products", parsed.rows, async (row, line) => {
      const errors = await this.validateProductRow(tenantId, row, line);
      if (errors.length) return { errors };
      const product = await this.prisma.product.create({
        data: {
          tenantId,
          sku: row.sku || this.generateCode("SKU"),
          name: row.name,
          description: row.description || undefined,
          purchasePrice: this.numberValue(row.purchasePrice),
          salePrice: this.numberValue(row.salePrice),
          wholesalePrice: this.numberValue(row.wholesalePrice),
          averageCost: this.numberValue(row.averageCost),
          minimumStock: this.integerValue(row.minimumStock),
          isActive: this.booleanValue(row.isActive, true),
          barcodes: row.barcode ? { create: { value: row.barcode, type: this.barcodeType(row.barcodeType), isPrimary: true } } : undefined,
          images: row.imageUrl ? { create: { url: row.imageUrl, alt: row.name, sortOrder: 0 } } : undefined,
          priceHistory: { create: { purchasePrice: this.numberValue(row.purchasePrice), salePrice: this.numberValue(row.salePrice), wholesalePrice: this.numberValue(row.wholesalePrice), averageCost: this.numberValue(row.averageCost) } }
        }
      });
      return { success: { line, id: product.id, label: product.name } };
    }, parsed.errors);
  }

  async importCustomers(tenantId: string, content: string) {
    const parsed = this.parseCsv(content, []);
    return this.importRows("customers", parsed.rows, async (row, line) => {
      const errors = await this.validateCustomerRow(tenantId, row, line);
      if (errors.length) return { errors };
      const displayName = row.displayName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.company;
      const customer = await this.prisma.customer.create({
        data: {
          tenantId,
          customerCode: row.customerCode || this.generateCode("CUST"),
          firstName: row.firstName || undefined,
          lastName: row.lastName || undefined,
          company: row.company || undefined,
          displayName,
          phone: row.phone || undefined,
          mobile: row.mobile || undefined,
          whatsapp: row.whatsapp || undefined,
          email: row.email || undefined,
          city: row.city || undefined,
          country: row.country || undefined,
          address: row.address || undefined,
          creditLimit: this.numberValue(row.creditLimit),
          currentBalance: this.numberValue(row.currentBalance),
          customerType: this.customerType(row.customerType),
          status: this.customerStatus(row.status),
          notes: row.notes || undefined
        }
      });
      return { success: { line, id: customer.id, label: customer.displayName } };
    }, parsed.errors);
  }

  async importSuppliers(tenantId: string, content: string) {
    const parsed = this.parseCsv(content, ["name"]);
    return this.importRows("suppliers", parsed.rows, async (row, line) => {
      const errors = await this.validateSupplierRow(tenantId, row, line);
      if (errors.length) return { errors };
      const supplier = await this.prisma.supplier.create({
        data: {
          tenantId,
          code: row.code || this.generateCode("SUP"),
          name: row.name,
          phone: row.phone || undefined,
          whatsapp: row.whatsapp || undefined,
          email: row.email || undefined,
          address: row.address || undefined,
          primaryContact: row.primaryContact || undefined,
          status: this.supplierStatus(row.status),
          balance: this.numberValue(row.balance),
          notes: row.notes || undefined
        }
      });
      return { success: { line, id: supplier.id, label: supplier.name } };
    }, parsed.errors);
  }

  private async importRows(entity: ImportEntity, rows: Array<{ line: number; record: CsvRecord }>, handler: (row: CsvRecord, line: number) => Promise<{ success?: ImportSuccess; errors?: ImportError[] }>, initialErrors: ImportError[]) {
    const successes: ImportSuccess[] = [];
    const errors: ImportError[] = [...initialErrors];
    for (const row of rows) {
      try {
        const result = await handler(row.record, row.line);
        if (result.success) successes.push(result.success);
        if (result.errors?.length) errors.push(...result.errors);
      } catch (error) {
        errors.push({ line: row.line, message: error instanceof Error ? error.message : "Erreur import inconnue" });
      }
    }
    return { entity, totalRows: rows.length, successCount: successes.length, failedCount: errors.length ? new Set(errors.map((item) => item.line)).size : 0, successes, errors, errorReport: this.buildErrorReport(errors) };
  }

  private parseCsv(content: string, requiredColumns: string[]) {
    const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!lines.length) throw new BadRequestException("Fichier vide");
    const headers = this.parseCsvLine(lines[0]).map((header) => this.normalizeHeader(header));
    const errors: ImportError[] = [];
    for (const column of requiredColumns) if (!headers.includes(column)) errors.push({ line: 1, field: column, message: `Colonne obligatoire manquante: ${column}` });
    const rows = lines.slice(1).map((line, index) => {
      const values = this.parseCsvLine(line);
      const record = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex]?.trim() ?? ""]));
      return { line: index + 2, record };
    });
    return { rows, errors };
  }

  private parseCsvLine(line: string) {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') { current += '"'; index++; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === "," && !quoted) { values.push(current); current = ""; continue; }
      current += char;
    }
    values.push(current);
    return values;
  }

  private async validateProductRow(tenantId: string, row: CsvRecord, line: number) {
    const errors: ImportError[] = [];
    if (!row.name) errors.push({ line, field: "name", message: "Le nom du produit est obligatoire" });
    for (const field of ["purchasePrice", "salePrice", "wholesalePrice", "averageCost"]) if (row[field] && !this.isValidNumber(row[field])) errors.push({ line, field, message: "Prix invalide", value: row[field] });
    if (row.minimumStock && !this.isValidInteger(row.minimumStock)) errors.push({ line, field: "minimumStock", message: "Quantite invalide", value: row.minimumStock });
    if (row.sku && await this.prisma.product.findFirst({ where: { tenantId, sku: row.sku } })) errors.push({ line, field: "sku", message: "SKU deja existant", value: row.sku });
    if (row.barcode && await this.prisma.barcode.findUnique({ where: { value: row.barcode } })) errors.push({ line, field: "barcode", message: "Code-barres deja existant", value: row.barcode });
    return errors;
  }

  private async validateCustomerRow(tenantId: string, row: CsvRecord, line: number) {
    const errors: ImportError[] = [];
    if (!(row.displayName || row.firstName || row.lastName || row.company)) errors.push({ line, field: "displayName", message: "Le nom du client est obligatoire" });
    if (row.email && !emailPattern.test(row.email)) errors.push({ line, field: "email", message: "Email invalide", value: row.email });
    for (const field of ["creditLimit", "currentBalance"]) if (row[field] && !this.isValidNumber(row[field])) errors.push({ line, field, message: "Montant invalide", value: row[field] });
    if (row.customerCode && await this.prisma.customer.findFirst({ where: { tenantId, customerCode: row.customerCode } })) errors.push({ line, field: "customerCode", message: "Code client deja existant", value: row.customerCode });
    return errors;
  }

  private async validateSupplierRow(tenantId: string, row: CsvRecord, line: number) {
    const errors: ImportError[] = [];
    if (!row.name) errors.push({ line, field: "name", message: "Le nom du fournisseur est obligatoire" });
    if (row.email && !emailPattern.test(row.email)) errors.push({ line, field: "email", message: "Email invalide", value: row.email });
    if (row.balance && !this.isValidNumber(row.balance)) errors.push({ line, field: "balance", message: "Montant invalide", value: row.balance });
    if (row.code && await this.prisma.supplier.findFirst({ where: { tenantId, code: row.code } })) errors.push({ line, field: "code", message: "Code fournisseur deja existant", value: row.code });
    return errors;
  }

  private normalizeHeader(value: string) { return value.trim().replace(/^"|"$/g, ""); }
  private numberValue(value?: string) { return value && this.isValidNumber(value) ? Number(value) : 0; }
  private integerValue(value?: string) { return value && this.isValidInteger(value) ? Number(value) : 0; }
  private isValidNumber(value: string) { return Number.isFinite(Number(value)) && Number(value) >= 0; }
  private isValidInteger(value: string) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
  private booleanValue(value: string | undefined, fallback: boolean) { if (!value) return fallback; return ["true", "1", "oui", "yes", "actif"].includes(value.toLowerCase()); }
  private barcodeType(value?: string) { return Object.values(BarcodeType).includes(value as BarcodeType) ? value as BarcodeType : BarcodeType.CUSTOM; }
  private customerType(value?: string) { return Object.values(CustomerType).includes(value as CustomerType) ? value as CustomerType : CustomerType.INDIVIDUAL; }
  private customerStatus(value?: string) { return Object.values(CustomerStatus).includes(value as CustomerStatus) ? value as CustomerStatus : CustomerStatus.ACTIVE; }
  private supplierStatus(value?: string) { return Object.values(SupplierStatus).includes(value as SupplierStatus) ? value as SupplierStatus : SupplierStatus.ACTIVE; }
  private generateCode(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  private buildErrorReport(errors: ImportError[]) { return ["line,field,message,value", ...errors.map((error) => [error.line, error.field ?? "", error.message, error.value ?? ""].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n"); }
}
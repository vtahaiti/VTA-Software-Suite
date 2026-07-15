import { BadRequestException, Injectable } from "@nestjs/common";
import { BarcodeType, CustomerStatus, CustomerType, InventoryMovementType, Prisma, SupplierStatus } from "@prisma/client";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";
import { ImportFileDto } from "./dto/import-file.dto";

type ImportEntity = "products" | "customers" | "suppliers";
type CsvRecord = Record<string, string>;
type ImportError = { line: number; field?: string; message: string; value?: string };
type ImportSuccess = { line: number; id: string; label: string; action?: "created" | "updated" | "ignored" };
type ParsedRows = { headers: string[]; rows: Array<{ line: number; record: CsvRecord }>; delimiter?: string; errors: ImportError[] };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const productHeaderAliases: Record<string, string[]> = {
  sku: ["code", "sku", "code interne", "reference", "référence"],
  name: ["produit", "nom", "name", "nom produit", "designation", "désignation"],
  category: ["categorie", "catégorie", "category"],
  stock: ["stock", "quantite", "quantité", "qte"],
  purchasePrice: ["prix d'achat", "prix achat", "cout", "coût", "purchaseprice", "purchase price"],
  salePrice: ["prix de vente", "prix vente", "saleprice", "sale price", "prix"],
  supplier: ["fournisseur", "supplier"],
  unit: ["unite", "unité", "unite de vente", "unité de vente", "unite d'achat", "unité d'achat", "unit"],
  supplierReference: ["reference fournisseur", "référence fournisseur", "ref fournisseur", "supplier reference"],
  barcode: ["code-barres", "code barre", "barcode", "codebarres"],
  minimumStock: ["stock faible", "stock minimum", "minimumstock", "seuil", "seuil d'alerte"],
  description: ["description"],
  isActive: ["actif", "active", "isactive", "statut"]
};

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeProducts(tenantId: string, dto: ImportFileDto) {
    const parsed = this.parseFile(dto, ["name"]);
    const mapping = this.resolveMapping(parsed.headers, dto.mapping, productHeaderAliases);
    const normalizedRows = parsed.rows.map((row) => ({ line: row.line, record: this.applyMapping(row.record, mapping) }));
    const errors = [...parsed.errors];
    const duplicates: ImportError[] = [];
    for (const row of normalizedRows) {
      const validation = await this.validateProductRow(tenantId, row.record, row.line, { allowDuplicates: true });
      errors.push(...validation.errors);
      duplicates.push(...validation.duplicates);
    }
    const failedLines = new Set(errors.map((item) => item.line));
    const duplicateLines = new Set(duplicates.map((item) => item.line));
    return {
      entity: "products",
      fileName: dto.fileName ?? "import-produits",
      format: this.resolveFormat(dto),
      delimiter: parsed.delimiter,
      headers: parsed.headers,
      mapping,
      preview: normalizedRows.slice(0, 10).map((row) => ({ line: row.line, ...row.record })),
      totalRows: normalizedRows.length,
      successCount: normalizedRows.filter((row) => !failedLines.has(row.line) && !duplicateLines.has(row.line)).length,
      failedCount: failedLines.size,
      duplicateCount: duplicateLines.size,
      ignoredCount: dto.duplicateStrategy === "ignore" ? duplicateLines.size : 0,
      errors,
      duplicates,
      errorReport: this.buildErrorReport([...errors, ...duplicates])
    };
  }

  async importProducts(tenantId: string, dtoOrContent: ImportFileDto | string) {
    const dto = typeof dtoOrContent === "string" ? { content: dtoOrContent, format: "CSV" as const } : dtoOrContent;
    const parsed = this.parseFile(dto, ["name"]);
    const mapping = this.resolveMapping(parsed.headers, dto.mapping, productHeaderAliases);
    const rows = parsed.rows.map((row) => ({ line: row.line, record: this.applyMapping(row.record, mapping) }));
    const duplicateStrategy = dto.duplicateStrategy ?? "ignore";
    const successes: ImportSuccess[] = [];
    const errors: ImportError[] = [...parsed.errors];
    const ignored: ImportSuccess[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const validation = await this.validateProductRow(tenantId, row.record, row.line, { allowDuplicates: true });
        if (validation.errors.length) {
          errors.push(...validation.errors);
          continue;
        }
        if (validation.duplicates.length && duplicateStrategy === "ignore") {
          ignored.push({ line: row.line, id: validation.duplicateProductId ?? "duplicate", label: row.record.name || row.record.sku || "Doublon", action: "ignored" });
          continue;
        }
        try {
          const categoryId = row.record.category ? await this.ensureCategory(tx, tenantId, row.record.category) : undefined;
          const supplierId = row.record.supplier ? await this.findSupplier(tx, tenantId, row.record.supplier) : undefined;
          const unitId = row.record.unit ? await this.ensureUnit(tx, tenantId, row.record.unit) : undefined;
          const data = {
            tenantId,
            sku: row.record.sku || this.generateCode("SKU"),
            name: row.record.name,
            categoryId,
            supplierId,
            unitId,
            reference: row.record.supplierReference || undefined,
            description: row.record.description || undefined,
            purchasePrice: this.numberValue(row.record.purchasePrice),
            salePrice: this.numberValue(row.record.salePrice),
            minimumStock: this.integerValue(row.record.minimumStock),
            isActive: this.booleanValue(row.record.isActive, true)
          };
          const product = validation.duplicateProductId && duplicateStrategy === "update"
            ? await tx.product.update({ where: { id: validation.duplicateProductId }, data })
            : await tx.product.create({ data });

          if (row.record.barcode) {
            const existingBarcode = await tx.barcode.findUnique({ where: { value: row.record.barcode } });
            if (!existingBarcode) await tx.barcode.create({ data: { productId: product.id, value: row.record.barcode, type: BarcodeType.CUSTOM, isPrimary: true } });
          }

          await this.applyInitialStock(tx, tenantId, product.id, row.record.stock, row.record.minimumStock);
          successes.push({ line: row.line, id: product.id, label: product.name, action: validation.duplicateProductId ? "updated" : "created" });
        } catch (error) {
          errors.push({ line: row.line, message: error instanceof Error ? error.message : "Erreur import inconnue" });
        }
      }
    });

    const failedLines = new Set(errors.map((item) => item.line));
    return {
      entity: "products",
      totalRows: rows.length,
      successCount: successes.length,
      failedCount: failedLines.size,
      ignoredCount: ignored.length,
      duplicateCount: ignored.length,
      successes,
      ignored,
      errors,
      errorReport: this.buildErrorReport(errors)
    };
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

  private parseFile(dto: ImportFileDto, requiredColumns: string[]) {
    const format = this.resolveFormat(dto);
    if (format === "XLSX") return this.parseXlsx(dto, requiredColumns);
    if (!dto.content) throw new BadRequestException("Le contenu du fichier est obligatoire");
    return this.parseCsv(dto.content, requiredColumns);
  }

  private parseXlsx(dto: ImportFileDto, requiredColumns: string[]): ParsedRows {
    if (!dto.contentBase64) throw new BadRequestException("Le contenu Excel est obligatoire");
    const workbook = XLSX.read(Buffer.from(dto.contentBase64, "base64"), { type: "buffer", cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new BadRequestException("Classeur Excel vide");
    const matrix = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[firstSheet], { header: 1, raw: false, defval: "" });
    return this.matrixToRows(matrix, requiredColumns);
  }

  private parseCsv(content: string, requiredColumns: string[]): ParsedRows {
    const clean = content.replace(/^\uFEFF/, "").replace(/^ï»¿/, "");
    const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!lines.length) throw new BadRequestException("Fichier vide");
    const delimiter = this.detectDelimiter(lines[0]);
    const matrix = lines.map((line) => this.parseDelimitedLine(line, delimiter));
    return { ...this.matrixToRows(matrix, requiredColumns), delimiter };
  }

  private matrixToRows(matrix: string[][], requiredColumns: string[]): ParsedRows {
    if (!matrix.length) throw new BadRequestException("Fichier vide");
    const headers = matrix[0].map((header) => this.normalizeHeader(header));
    const canonicalHeaders = headers.map((header) => this.canonicalHeader(header));
    const errors: ImportError[] = [];
    for (const column of requiredColumns) if (!canonicalHeaders.includes(column)) errors.push({ line: 1, field: column, message: `Colonne obligatoire manquante: ${column}` });
    const rows = matrix.slice(1).filter((line) => line.some((value) => String(value ?? "").trim())).map((line, index) => {
      const record = Object.fromEntries(headers.map((header, valueIndex) => [header, String(line[valueIndex] ?? "").trim()]));
      return { line: index + 2, record };
    });
    return { headers, rows, errors };
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
    const failedLines = new Set(errors.map((item) => item.line));
    return { entity, totalRows: rows.length, successCount: successes.length, failedCount: failedLines.size, ignoredCount: 0, successes, errors, errorReport: this.buildErrorReport(errors) };
  }

  private async validateProductRow(tenantId: string, row: CsvRecord, line: number, options: { allowDuplicates?: boolean } = {}) {
    const errors: ImportError[] = [];
    const duplicates: ImportError[] = [];
    let duplicateProductId: string | undefined;
    if (!row.name) errors.push({ line, field: "name", message: "Le nom du produit est obligatoire" });
    if (!row.salePrice && row.salePrice !== "0") errors.push({ line, field: "salePrice", message: "Le prix de vente est obligatoire" });
    for (const field of ["purchasePrice", "salePrice"]) if (row[field] && !this.isValidNumber(row[field])) errors.push({ line, field, message: "Montant invalide", value: row[field] });
    for (const field of ["minimumStock", "stock"]) if (row[field] && !this.isValidInteger(row[field])) errors.push({ line, field, message: "Quantité invalide", value: row[field] });
    if (row.sku) {
      const product = await this.prisma.product.findFirst({ where: { tenantId, sku: row.sku } });
      if (product) {
        duplicateProductId = product.id;
        duplicates.push({ line, field: "sku", message: "SKU déjà existant", value: row.sku });
      }
    }
    if (row.barcode) {
      const barcode = await this.prisma.barcode.findUnique({ where: { value: row.barcode }, include: { product: true } });
      if (barcode && barcode.product.tenantId === tenantId) {
        duplicateProductId ??= barcode.productId;
        duplicates.push({ line, field: "barcode", message: "Code-barres déjà existant", value: row.barcode });
      }
    }
    return { errors: options.allowDuplicates ? errors : [...errors, ...duplicates], duplicates, duplicateProductId };
  }

  private async validateCustomerRow(tenantId: string, row: CsvRecord, line: number) {
    const errors: ImportError[] = [];
    if (!(row.displayName || row.firstName || row.lastName || row.company)) errors.push({ line, field: "displayName", message: "Le nom du client est obligatoire" });
    if (row.email && !emailPattern.test(row.email)) errors.push({ line, field: "email", message: "Email invalide", value: row.email });
    for (const field of ["creditLimit", "currentBalance"]) if (row[field] && !this.isValidNumber(row[field])) errors.push({ line, field, message: "Montant invalide", value: row[field] });
    if (row.customerCode && await this.prisma.customer.findFirst({ where: { tenantId, customerCode: row.customerCode } })) errors.push({ line, field: "customerCode", message: "Code client déjà existant", value: row.customerCode });
    return errors;
  }

  private async validateSupplierRow(tenantId: string, row: CsvRecord, line: number) {
    const errors: ImportError[] = [];
    if (!row.name) errors.push({ line, field: "name", message: "Le nom du fournisseur est obligatoire" });
    if (row.email && !emailPattern.test(row.email)) errors.push({ line, field: "email", message: "Email invalide", value: row.email });
    if (row.balance && !this.isValidNumber(row.balance)) errors.push({ line, field: "balance", message: "Montant invalide", value: row.balance });
    if (row.code && await this.prisma.supplier.findFirst({ where: { tenantId, code: row.code } })) errors.push({ line, field: "code", message: "Code fournisseur déjà existant", value: row.code });
    return errors;
  }

  private resolveFormat(dto: ImportFileDto) {
    const value = (dto.format ?? (dto.fileName?.toLowerCase().endsWith(".xlsx") ? "XLSX" : "CSV")).toUpperCase();
    return value === "EXCEL" ? "XLSX" : value as "CSV" | "XLSX";
  }
  private detectDelimiter(headerLine: string) { const options = [",", ";", "\t"]; return options.map((delimiter) => ({ delimiter, count: this.parseDelimitedLine(headerLine, delimiter).length })).sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","; }
  private parseDelimitedLine(line: string, delimiter: string) {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      const next = line[index + 1];
      if (char === "\"" && quoted && next === "\"") { current += "\""; index++; continue; }
      if (char === "\"") { quoted = !quoted; continue; }
      if (char === delimiter && !quoted) { values.push(current); current = ""; continue; }
      current += char;
    }
    values.push(current);
    return values;
  }
  private normalizeHeader(value: string) { return String(value ?? "").trim().replace(/^"|"$/g, ""); }
  private normalizeKey(value: string) { return this.normalizeHeader(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(); }
  private canonicalHeader(header: string) { const normalized = this.normalizeKey(header); for (const [field, aliases] of Object.entries(productHeaderAliases)) if (aliases.map((item) => this.normalizeKey(item)).includes(normalized)) return field; return header; }
  private resolveMapping(headers: string[], provided: Record<string, string> | undefined, aliases: Record<string, string[]>) { if (provided && Object.keys(provided).length) return provided; const mapping: Record<string, string> = {}; for (const header of headers) { const normalized = this.normalizeKey(header); const match = Object.entries(aliases).find(([, values]) => values.map((item) => this.normalizeKey(item)).includes(normalized)); if (match) mapping[header] = match[0]; } return mapping; }
  private applyMapping(record: CsvRecord, mapping: Record<string, string>) { const mapped: CsvRecord = {}; for (const [header, value] of Object.entries(record)) mapped[mapping[header] ?? this.canonicalHeader(header)] = value; return mapped; }
  private numberValue(value?: string) { if (!value) return 0; const normalized = String(value).replace(/\s/g, "").replace(",", "."); return this.isValidNumber(normalized) ? Number(normalized) : 0; }
  private integerValue(value?: string) { return value && this.isValidInteger(value) ? Number(value) : 0; }
  private isValidNumber(value: string) { const normalized = String(value).replace(/\s/g, "").replace(",", "."); return Number.isFinite(Number(normalized)) && Number(normalized) >= 0; }
  private isValidInteger(value: string) { return Number.isInteger(Number(value)) && Number(value) >= 0; }
  private booleanValue(value: string | undefined, fallback: boolean) { if (!value) return fallback; return ["true", "1", "oui", "yes", "actif", "active"].includes(value.toLowerCase()); }
  private customerType(value?: string) { return Object.values(CustomerType).includes(value as CustomerType) ? value as CustomerType : CustomerType.INDIVIDUAL; }
  private customerStatus(value?: string) { return Object.values(CustomerStatus).includes(value as CustomerStatus) ? value as CustomerStatus : CustomerStatus.ACTIVE; }
  private supplierStatus(value?: string) { return Object.values(SupplierStatus).includes(value as SupplierStatus) ? value as SupplierStatus : SupplierStatus.ACTIVE; }
  private generateCode(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  private slug(value: string) { return this.normalizeKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || this.generateCode("cat").toLowerCase(); }
  private async ensureCategory(tx: Prisma.TransactionClient, tenantId: string, name: string) { const slug = this.slug(name); const existing = await tx.category.findFirst({ where: { tenantId, OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] } }); if (existing) return existing.id; const category = await tx.category.create({ data: { tenantId, name, slug } }); return category.id; }
  private async ensureUnit(tx: Prisma.TransactionClient, tenantId: string, name: string) { const symbol = name.trim(); const existing = await tx.unit.findFirst({ where: { tenantId, OR: [{ symbol: { equals: symbol, mode: "insensitive" } }, { name: { equals: symbol, mode: "insensitive" } }] } }); if (existing) return existing.id; const unit = await tx.unit.create({ data: { tenantId, name: symbol, symbol } }); return unit.id; }
  private async findSupplier(tx: Prisma.TransactionClient, tenantId: string, name: string) { const supplier = await tx.supplier.findFirst({ where: { tenantId, name: { equals: name, mode: "insensitive" } } }); return supplier?.id; }
  private async applyInitialStock(tx: Prisma.TransactionClient, tenantId: string, productId: string, stockValue?: string, minimumStockValue?: string) {
    if (!stockValue || !this.isValidInteger(stockValue)) return;
    const quantity = Number(stockValue);
    const warehouse = await tx.warehouse.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    if (!warehouse) return;
    const current = await tx.stock.findUnique({ where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId: warehouse.id } } });
    const beforeQty = current?.quantity ?? 0;
    const afterQty = quantity;
    await tx.stock.upsert({ where: { tenantId_productId_warehouseId: { tenantId, productId, warehouseId: warehouse.id } }, create: { tenantId, productId, warehouseId: warehouse.id, quantity, minimumStock: this.integerValue(minimumStockValue) }, update: { quantity, minimumStock: this.integerValue(minimumStockValue) } });
    if (quantity !== beforeQty) await tx.inventoryMovement.create({ data: { tenantId, productId, warehouseId: warehouse.id, type: InventoryMovementType.IN, quantity: quantity - beforeQty, beforeQty, afterQty, reference: "IMPORT", note: "Stock initial importé" } });
  }
  private buildErrorReport(errors: ImportError[]) { return "\uFEFF" + ["ligne;colonne;valeur;raison", ...errors.map((error) => [error.line, error.field ?? "", error.value ?? "", error.message].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))].join("\n"); }
}



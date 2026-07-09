import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateReferenceDto } from "./dto/create-reference.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateReferenceDto } from "./dto/update-reference.dto";

const productInclude = { category: true, brand: true, unit: true, supplier: true, barcodes: true, images: true, variants: true, stocks: true };

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const now = new Date();
    const [totalProducts, lowStockProducts, expiredProducts, outOfStockProducts, topSold] = await Promise.all([
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, stocks: { some: { quantity: { lte: this.prisma.stock.fields.minimumStock } } } } }).catch(() => 0),
      this.prisma.product.count({ where: { tenantId, expirationDate: { lt: now } } }),
      this.prisma.product.count({ where: { tenantId, stocks: { every: { quantity: 0 } } } }),
      this.prisma.saleItem.groupBy({ by: ["productId"], _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }).catch(() => [])
    ]);
    return { totalProducts, lowStockProducts, expiredProducts, outOfStockProducts, topSold };
  }

  async findAll(tenantId: string, query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.q ?? query.search;
    const where: Prisma.ProductWhereInput = {
      tenantId,
      categoryId: query.categoryId,
      brandId: query.brandId,
      unitId: query.unitId,
      isActive: query.isActive,
      OR: search ? [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
        { qrCode: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { name: { contains: search, mode: "insensitive" } } },
        { brand: { name: { contains: search, mode: "insensitive" } } },
        { barcodes: { some: { value: { contains: search } } } },
        { variants: { some: { OR: [{ sku: { contains: search, mode: "insensitive" } }, { barcode: { contains: search } }, { name: { contains: search, mode: "insensitive" } }] } } }
      ] : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, include: productInclude, skip: (page - 1) * limit, take: limit, orderBy: { [query.sortBy ?? "createdAt"]: query.sortOrder ?? "desc" } }),
      this.prisma.product.count({ where })
    ]);
    return { items: items.map((item) => this.withComputedFields(item)), meta: { page, limit, total, pageCount: Math.ceil(total / limit) } };
  }

  async search(tenantId: string, q: string, query: ProductQueryDto) {
    return this.findAll(tenantId, { ...query, search: q, q, isActive: true });
  }

  async findByBarcode(tenantId: string, barcode: string) {
    const term = barcode.trim();
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { sku: { equals: term, mode: "insensitive" } },
          { reference: { equals: term, mode: "insensitive" } },
          { qrCode: { equals: term, mode: "insensitive" } },
          { name: { equals: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { barcodes: { some: { value: term } } },
          { variants: { some: { OR: [{ sku: { equals: term, mode: "insensitive" } }, { barcode: term }] } } }
        ]
      },
      include: productInclude
    });
    if (!product) throw new NotFoundException("Produit introuvable");
    return this.withComputedFields(product);
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId }, include: { ...productInclude, stocks: { include: { warehouse: { include: { store: true } } } }, priceHistory: { orderBy: { createdAt: "desc" }, take: 10 }, movements: { orderBy: { createdAt: "desc" }, take: 20 } } });
    if (!product) throw new NotFoundException("Produit introuvable");
    return this.withComputedFields(product);
  }

  async create(tenantId: string, dto: CreateProductDto) {
    const sku = dto.sku ?? this.generateSku(dto.name);
    try {
      return this.withComputedFields(await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({ data: this.productCreateData(tenantId, sku, dto), include: productInclude });
        const stockInitial = Number(dto.stockInitial ?? 0);
        if (stockInitial > 0) {
          const warehouse = dto.warehouseId
            ? await tx.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } })
            : await tx.warehouse.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: "asc" } });
          if (warehouse) {
            await tx.stock.create({
              data: { tenantId, productId: product.id, warehouseId: warehouse.id, quantity: stockInitial, minimumStock: dto.minimumStock ?? 0 }
            });
            await tx.inventoryMovement.create({
              data: {
                tenantId,
                productId: product.id,
                warehouseId: warehouse.id,
                storeId: warehouse.storeId,
                type: "ADJUSTMENT",
                reason: "Stock initial",
                quantity: stockInitial,
                beforeQty: 0,
                afterQty: stockInitial,
                reference: sku,
                note: "Creation produit"
              }
            });
          }
        }
        return tx.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Produit ou code-barres deja existant");
      throw error;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.barcodes) await tx.barcode.deleteMany({ where: { productId: id } });
      if (dto.images) await tx.productImage.deleteMany({ where: { productId: id } });
      if (dto.variants) await tx.productVariant.deleteMany({ where: { productId: id } });
      const product = await tx.product.update({ where: { id }, data: this.productUpdateData(dto), include: productInclude });
      if ([dto.purchasePrice, dto.salePrice, dto.wholesalePrice, dto.averageCost].some((value) => value !== undefined)) {
        await tx.priceHistory.create({ data: { productId: id, purchasePrice: dto.purchasePrice ?? product.purchasePrice, salePrice: dto.salePrice ?? product.salePrice, wholesalePrice: dto.wholesalePrice ?? product.wholesalePrice, averageCost: dto.averageCost ?? product.averageCost } });
      }
      return this.withComputedFields(product);
    });
  }

  async remove(tenantId: string, id: string) { await this.findOne(tenantId, id); await this.prisma.product.delete({ where: { id } }); return { success: true }; }

  async importCsv(tenantId: string, csv: string) {
    const rows = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const [header, ...dataRows] = rows;
    const columns = header.split(",").map((item) => item.trim());
    const created = [];
    const failed: Array<{ row: number; error: string }> = [];
    for (const [index, row] of dataRows.entries()) {
      try {
        const values = row.split(",").map((item) => item.trim());
        const record = Object.fromEntries(columns.map((column, valueIndex) => [column, values[valueIndex] ?? ""]));
        created.push(await this.create(tenantId, { name: record.name, sku: record.sku || undefined, reference: record.reference || undefined, qrCode: record.qrCode || undefined, salePrice: Number(record.salePrice || 0), purchasePrice: Number(record.purchasePrice || 0), promotionalPrice: record.promotionalPrice ? Number(record.promotionalPrice) : undefined, minimumStock: Number(record.minimumStock || 0), maximumStock: Number(record.maximumStock || 0), location: record.location || undefined }));
      } catch (error) {
        failed.push({ row: index + 2, error: error instanceof Error ? error.message : "Ligne invalide" });
      }
    }
    return { imported: created.length, failed: failed.length, errors: failed, items: created };
  }

  importExcel(tenantId: string, content: string) { return this.importCsv(tenantId, content); }

  async exportCsv(tenantId: string) {
    const products = await this.prisma.product.findMany({ where: { tenantId }, include: productInclude, orderBy: { name: "asc" } });
    const rows = products.map((p) => [p.sku, p.reference ?? "", p.name, p.category?.name ?? "", p.brand?.name ?? "", p.supplier?.name ?? "", p.purchasePrice, p.salePrice, p.promotionalPrice ?? "", p.minimumStock, p.maximumStock, p.location ?? "", p.isActive ? "Actif" : "Inactif"]);
    return [["SKU", "Reference", "Produit", "Categorie", "Marque", "Fournisseur", "Prix achat", "Prix vente", "Prix promo", "Stock min", "Stock max", "Emplacement", "Statut"], ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  async exportExcel(tenantId: string) {
    const products = await this.prisma.product.findMany({ where: { tenantId }, include: productInclude, orderBy: { name: "asc" } });
    const rows = products.map((p) => `<tr><td>${p.sku}</td><td>${p.name}</td><td>${p.category?.name ?? ""}</td><td>${p.brand?.name ?? ""}</td><td>${p.supplier?.name ?? ""}</td><td>${p.purchasePrice}</td><td>${p.salePrice}</td><td>${p.promotionalPrice ?? ""}</td><td>${p.isActive ? "Actif" : "Inactif"}</td></tr>`).join("");
    return `<table><thead><tr><th>SKU</th><th>Produit</th><th>Categorie</th><th>Marque</th><th>Fournisseur</th><th>Prix achat</th><th>Prix vente</th><th>Prix promo</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  async exportPdf(tenantId: string) {
    const products = await this.prisma.product.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 });
    return `Rapport produits VTA Commerce\n\n${products.map((product) => `${product.sku} - ${product.name} - ${product.salePrice}`).join("\n")}`;
  }

  labelData(tenantId: string, id: string) { return this.findOne(tenantId, id); }

  findCategories(tenantId: string) { return this.prisma.category.findMany({ where: { tenantId }, orderBy: { name: "asc" } }); }
  createCategory(tenantId: string, dto: CreateReferenceDto) { return this.prisma.category.create({ data: { tenantId, name: dto.name, slug: this.slug(dto.name), imageUrl: dto.imageUrl, icon: dto.icon, isActive: dto.isActive ?? true } }); }
  async updateCategory(tenantId: string, id: string, dto: UpdateReferenceDto) { await this.ensureCategory(tenantId, id); return this.prisma.category.update({ where: { id }, data: { name: dto.name, slug: dto.name ? this.slug(dto.name) : undefined, imageUrl: dto.imageUrl, icon: dto.icon, isActive: dto.isActive } }); }
  async deleteCategory(tenantId: string, id: string) { await this.ensureCategory(tenantId, id); return this.prisma.category.delete({ where: { id } }); }
  findBrands(tenantId: string) { return this.prisma.brand.findMany({ where: { tenantId }, orderBy: { name: "asc" } }); }
  createBrand(tenantId: string, dto: CreateReferenceDto) { return this.prisma.brand.create({ data: { tenantId, name: dto.name, slug: this.slug(dto.name), isActive: dto.isActive ?? true } }); }
  async updateBrand(tenantId: string, id: string, dto: UpdateReferenceDto) { await this.ensureBrand(tenantId, id); return this.prisma.brand.update({ where: { id }, data: { name: dto.name, slug: dto.name ? this.slug(dto.name) : undefined, isActive: dto.isActive } }); }
  async deleteBrand(tenantId: string, id: string) { await this.ensureBrand(tenantId, id); return this.prisma.brand.delete({ where: { id } }); }
  findUnits(tenantId: string) { return this.prisma.unit.findMany({ where: { tenantId }, orderBy: { name: "asc" } }); }
  createUnit(tenantId: string, dto: CreateReferenceDto) { return this.prisma.unit.create({ data: { tenantId, name: dto.name, symbol: dto.symbol ?? dto.name, isActive: dto.isActive ?? true } }); }
  async updateUnit(tenantId: string, id: string, dto: UpdateReferenceDto) { await this.ensureUnit(tenantId, id); return this.prisma.unit.update({ where: { id }, data: { name: dto.name, symbol: dto.symbol, isActive: dto.isActive } }); }
  async deleteUnit(tenantId: string, id: string) { await this.ensureUnit(tenantId, id); return this.prisma.unit.delete({ where: { id } }); }

  private productCreateData(tenantId: string, sku: string, dto: CreateProductDto): Prisma.ProductCreateInput {
    return {
      tenant: { connect: { id: tenantId } }, sku, name: dto.name, description: dto.description, isActive: dto.isActive ?? true,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      brand: dto.brandId ? { connect: { id: dto.brandId } } : undefined,
      unit: dto.unitId ? { connect: { id: dto.unitId } } : undefined,
      supplier: dto.supplierId ? { connect: { id: dto.supplierId } } : undefined,
      subCategory: dto.subCategory, reference: dto.reference, qrCode: dto.qrCode ?? this.generateQrCode(sku), promotionalPrice: dto.promotionalPrice, taxRate: dto.taxRate ?? 0,
      purchasePrice: dto.purchasePrice ?? 0, salePrice: dto.salePrice ?? 0, wholesalePrice: dto.wholesalePrice ?? 0, averageCost: dto.averageCost ?? 0, minimumStock: dto.minimumStock ?? 0, maximumStock: dto.maximumStock ?? 0,
      location: dto.location, storeId: dto.storeId, warehouseId: dto.warehouseId, manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : undefined, expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined, warrantyMonths: dto.warrantyMonths,
      barcodes: { create: dto.barcodes?.length ? dto.barcodes : [{ value: this.generateBarcode(), type: "EAN", isPrimary: true }] },
      images: { create: dto.images ?? [] }, variants: { create: dto.variants ?? [] },
      priceHistory: { create: { purchasePrice: dto.purchasePrice ?? 0, salePrice: dto.salePrice ?? 0, wholesalePrice: dto.wholesalePrice ?? 0, averageCost: dto.averageCost ?? 0 } }
    };
  }

  private productUpdateData(dto: UpdateProductDto): Prisma.ProductUpdateInput {
    return {
      sku: dto.sku, name: dto.name, description: dto.description, isActive: dto.isActive,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      brand: dto.brandId ? { connect: { id: dto.brandId } } : undefined,
      unit: dto.unitId ? { connect: { id: dto.unitId } } : undefined,
      supplier: dto.supplierId ? { connect: { id: dto.supplierId } } : undefined,
      subCategory: dto.subCategory, reference: dto.reference, qrCode: dto.qrCode, promotionalPrice: dto.promotionalPrice, taxRate: dto.taxRate,
      purchasePrice: dto.purchasePrice, salePrice: dto.salePrice, wholesalePrice: dto.wholesalePrice, averageCost: dto.averageCost, minimumStock: dto.minimumStock, maximumStock: dto.maximumStock,
      location: dto.location, storeId: dto.storeId, warehouseId: dto.warehouseId, manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : undefined, expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined, warrantyMonths: dto.warrantyMonths,
      barcodes: dto.barcodes ? { create: dto.barcodes } : undefined, images: dto.images ? { create: dto.images } : undefined, variants: dto.variants ? { create: dto.variants } : undefined
    };
  }

  private withComputedFields<T extends { purchasePrice: unknown; salePrice: unknown; promotionalPrice?: unknown; variants?: Array<{ stock: number }>; stocks?: Array<{ quantity: number }> }>(product: T) {
    const purchase = Number(product.purchasePrice ?? 0);
    const sale = Number(product.promotionalPrice ?? product.salePrice ?? 0);
    const marginAmount = sale - purchase;
    const marginRate = sale > 0 ? Number(((marginAmount / sale) * 100).toFixed(2)) : 0;
    const stockCurrent = product.stocks?.reduce((sum, stock) => sum + Number(stock.quantity ?? 0), 0) ?? product.variants?.reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0) ?? 0;
    return { ...product, marginAmount, marginRate, stockCurrent };
  }

  private async ensureCategory(tenantId: string, id: string) { if (!(await this.prisma.category.findFirst({ where: { id, tenantId } }))) throw new NotFoundException("Categorie introuvable"); }
  private async ensureBrand(tenantId: string, id: string) { if (!(await this.prisma.brand.findFirst({ where: { id, tenantId } }))) throw new NotFoundException("Marque introuvable"); }
  private async ensureUnit(tenantId: string, id: string) { if (!(await this.prisma.unit.findFirst({ where: { id, tenantId } }))) throw new NotFoundException("Unite introuvable"); }

  private generateSku(name: string) { return `${this.slug(name).slice(0, 24)}-${Date.now().toString(36)}`.toUpperCase(); }
  private generateBarcode() { const base = Date.now().toString().slice(-12); return base.padStart(12, "0"); }
  private generateQrCode(sku: string) { return `VTA:${sku}:${Date.now().toString(36)}`; }
  private slug(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
}

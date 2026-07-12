import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { CreateCustomerDto } from "../customers/dto/create-customer.dto";
import { CreateSaleDto } from "../sales/dto/create-sale.dto";
import { SaleQueryDto } from "../sales/dto/sale-query.dto";
import { SalesService } from "../sales/sales.service";
import { PosCartAddDto, PosCartDto, PosCartRemoveDto, PosCartUpdateDto } from "./dto/pos-cart.dto";
import { SyncOfflineSalesDto } from "./dto/sync-offline-sales.dto";
import { PosService } from "./pos.service";

type HeldSaleRequest = {
  id?: string;
  cart: Prisma.InputJsonValue;
  customerId?: string | null;
  payments?: Prisma.InputJsonValue;
  orderDiscount?: number;
  taxRate?: number;
  storeId?: string | null;
  warehouseId?: string | null;
  cashSessionId?: string | null;
  total?: number;
  note?: string | null;
};

type HeldSaleReleaseRequest = { force?: boolean };
type HeldSaleFinalizeRequest = { sale: CreateSaleDto; idempotencyKey: string };

@RequiresFeature("POS")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("pos")
export class PosController {
  constructor(private readonly pos: PosService, private readonly sales: SalesService) {}

  @Get("context")
  @Permissions("pos.sell")
  context(@Req() req: AuthenticatedRequest) {
    return this.pos.context(req.user.tenantId);
  }

  @Get("products")
  @Permissions("pos.sell")
  productsSearch(@Req() req: AuthenticatedRequest, @Query() query: ProductQueryDto) {
    return this.pos.searchProducts(req.user.tenantId, query);
  }

  @Get("scan")
  @Permissions("pos.sell")
  scan(@Req() req: AuthenticatedRequest, @Query("barcode") barcode: string) {
    return this.pos.scanProduct(req.user.tenantId, barcode);
  }

  @Post("cart/calculate")
  @Permissions("pos.sell")
  calculateCart(@Req() req: AuthenticatedRequest, @Body() dto: PosCartDto) {
    return this.pos.calculateCart(req.user.tenantId, dto);
  }

  @Post("cart/add")
  @Permissions("pos.sell")
  addToCart(@Req() req: AuthenticatedRequest, @Body() dto: PosCartAddDto) {
    return this.pos.addToCart(req.user.tenantId, dto);
  }

  @Post("cart/update")
  @Permissions("pos.sell")
  updateCartItem(@Req() req: AuthenticatedRequest, @Body() dto: PosCartUpdateDto) {
    return this.pos.updateCartItem(req.user.tenantId, dto);
  }

  @Post("cart/remove")
  @Permissions("pos.sell")
  removeFromCart(@Req() req: AuthenticatedRequest, @Body() dto: PosCartRemoveDto) {
    return this.pos.removeFromCart(req.user.tenantId, dto);
  }

  @Post("checkout")
  @Permissions("pos.sell")
  checkout(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) {
    if (!dto.cashSessionId) throw new BadRequestException("Une caisse ouverte est obligatoire avant la vente");
    if (this.paidAmount(dto) <= 0) throw new BadRequestException("Montant recu obligatoire avant l encaissement");
    return this.sales.create(req.user.tenantId, dto, req.user.id);
  }

  @Post("quotes")
  @RequiresFeature("QUOTES")
  @Permissions("pos.sell")
  createQuote(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) {
    return this.pos.createQuoteFromCart(req.user.tenantId, dto, req.user.id);
  }

  @Post("orders")
  @RequiresFeature("ORDERS")
  @Permissions("pos.sell")
  createOrder(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) {
    return this.pos.createOrderFromCart(req.user.tenantId, dto, req.user.id);
  }


  @Get("held-sales")
  @RequiresFeature("HELD_SALES")
  @Permissions("pos.sell")
  heldSales(@Req() req: AuthenticatedRequest) {
    return this.pos.listHeldSales(req.user.tenantId, req.user.id, req.user.sessionId);
  }

  @Post("held-sales")
  @RequiresFeature("HELD_SALES")
  @Permissions("pos.sell")
  saveHeldSale(@Req() req: AuthenticatedRequest, @Body() dto: HeldSaleRequest) {
    return this.pos.saveHeldSale(req.user.tenantId, req.user.id, req.user.sessionId, dto);
  }

  @Post("held-sales/:id/claim")
  @RequiresFeature("HELD_SALES")
  @Permissions("pos.sell")
  claimHeldSale(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.pos.claimHeldSale(req.user.tenantId, req.user.id, req.user.sessionId, id);
  }

  @Post("held-sales/:id/release")
  @RequiresFeature("HELD_SALES")
  @Permissions("pos.sell")
  releaseHeldSale(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: HeldSaleReleaseRequest) {
    return this.pos.releaseHeldSale(req.user.tenantId, req.user.id, req.user.sessionId, id, Boolean(dto?.force && this.canForceHeldSale(req)));
  }

  @Post("held-sales/:id/finalize")
  @RequiresFeature("HELD_SALES")
  @Permissions("pos.sell")
  finalizeHeldSale(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: HeldSaleFinalizeRequest) {
    if (!dto?.sale?.cashSessionId) throw new BadRequestException("Une caisse ouverte est obligatoire avant la vente");
    if (this.paidAmount(dto.sale) <= 0) throw new BadRequestException("Montant recu obligatoire avant l encaissement");
    return this.pos.finalizeHeldSale(req.user.tenantId, req.user.id, req.user.sessionId, id, dto.sale, dto.idempotencyKey);
  }

  @Delete("held-sales/:id")
  @RequiresFeature("HELD_SALES")
  @Permissions("pos.sell")
  deleteHeldSale(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.pos.deleteHeldSale(req.user.tenantId, req.user.id, req.user.sessionId, id, this.canForceHeldSale(req));
  }
  @Post("customers")
  @Permissions("pos.sell")
  createCustomer(@Req() req: AuthenticatedRequest, @Body() dto: CreateCustomerDto) {
    return this.pos.createCustomer(req.user.tenantId, dto);
  }

  @Post("sync-offline-sales")
  @Permissions("pos.sell")
  async syncOfflineSales(@Req() req: AuthenticatedRequest, @Body() dto: SyncOfflineSalesDto) {
    const results = [];
    for (const offlineSale of dto.sales) {
      const { localId, createdOfflineAt, ...saleDto } = offlineSale;
      void createdOfflineAt;
      try {
        if (!saleDto.cashSessionId) throw new BadRequestException("Une caisse ouverte est obligatoire avant la synchronisation");
        if (this.paidAmount(saleDto) <= 0) throw new BadRequestException("Montant recu obligatoire avant la synchronisation");
        const sale = await this.sales.create(req.user.tenantId, saleDto, req.user.id);
        results.push({ localId, status: "SYNCED", saleId: sale.id, receipt: sale.receipt ?? null });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Synchronisation impossible";
        const status = message.toLowerCase().includes("stock insuffisant") ? "CONFLICT" : "ERROR";
        results.push({ localId, status, message: status === "CONFLICT" ? "Conflit de stock à vérifier" : message });
      }
    }
    return { results };
  }

  @Get("history")
  @RequiresFeature("SALES_HISTORY")
  @Permissions("sales.view")
  history(@Req() req: AuthenticatedRequest, @Query() query: SaleQueryDto) {
    return this.sales.findAll(req.user.tenantId, query);
  }

  private canForceHeldSale(req: AuthenticatedRequest) {
    const roles = new Set([req.user.role, ...(req.user.roles ?? [])].filter(Boolean).map((role) => String(role).toUpperCase()));
    return roles.has("OWNER") || roles.has("ADMIN") || roles.has("MANAGER");
  }

  private paidAmount(dto: Pick<CreateSaleDto, "payments">) {
    return (dto.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }
}

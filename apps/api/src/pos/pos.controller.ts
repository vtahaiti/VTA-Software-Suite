import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateCustomerDto } from "../customers/dto/create-customer.dto";
import { CreateSaleDto } from "../sales/dto/create-sale.dto";
import { SaleQueryDto } from "../sales/dto/sale-query.dto";
import { SalesService } from "../sales/sales.service";
import { PosCartAddDto, PosCartDto, PosCartRemoveDto, PosCartUpdateDto } from "./dto/pos-cart.dto";
import { SyncOfflineSalesDto } from "./dto/sync-offline-sales.dto";
import { PosService } from "./pos.service";

@UseGuards(JwtAuthGuard)
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
  @Permissions("pos.sell")
  createQuote(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) {
    return this.pos.createQuoteFromCart(req.user.tenantId, dto, req.user.id);
  }

  @Post("orders")
  @Permissions("pos.sell")
  createOrder(@Req() req: AuthenticatedRequest, @Body() dto: CreateSaleDto) {
    return this.pos.createOrderFromCart(req.user.tenantId, dto, req.user.id);
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
      const { localId, createdOfflineAt: _createdOfflineAt, ...saleDto } = offlineSale;
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
  @Permissions("sales.view")
  history(@Req() req: AuthenticatedRequest, @Query() query: SaleQueryDto) {
    return this.sales.findAll(req.user.tenantId, query);
  }

  private paidAmount(dto: Pick<CreateSaleDto, "payments">) {
    return (dto.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }
}

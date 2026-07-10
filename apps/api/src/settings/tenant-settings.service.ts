import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateInvoicingSettingsDto, UpdatePosSettingsDto } from "./dto/settings.dto";

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: string) {
    return this.ensure(tenantId);
  }

  async updatePos(tenantId: string, dto: UpdatePosSettingsDto) {
    await this.ensure(tenantId);
    return this.prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        allowNegativeStock: dto.allowNegativeStock,
        allowDiscount: dto.allowDiscount,
        requireCustomer: dto.requireCustomer,
        autoPrintReceipt: dto.autoPrintReceipt,
        openCashDrawer: dto.openCashDrawer
      }
    });
  }

  async updateInvoicing(tenantId: string, dto: UpdateInvoicingSettingsDto) {
    await this.ensure(tenantId);
    return this.prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        defaultTaxRate: dto.defaultTaxRate,
        maxDiscountRate: dto.maxDiscountRate,
        invoicePrefix: dto.invoicePrefix,
        quotePrefix: dto.quotePrefix,
        receiptPrefix: dto.receiptPrefix,
        posReceiptFormat: dto.posReceiptFormat,
        invoiceFormat: dto.invoiceFormat
      }
    });
  }

  private ensure(tenantId: string) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId }
    });
  }
}
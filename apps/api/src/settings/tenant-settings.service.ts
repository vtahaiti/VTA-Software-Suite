import { Injectable } from "@nestjs/common";
import type { TenantSettings } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateInvoicingSettingsDto, UpdatePosSettingsDto } from "./dto/settings.dto";

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: string) {
    const settings = await this.ensure(tenantId);
    return this.toApi(settings);
  }

  async updatePos(tenantId: string, dto: UpdatePosSettingsDto) {
    await this.ensure(tenantId);
    const settings = await this.prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        allowNegativeStock: dto.allowNegativeStock,
        allowDiscount: dto.allowDiscount,
        requireCustomer: dto.requireCustomer,
        autoPrintReceipt: dto.autoPrintReceipt,
        openCashDrawer: dto.openCashDrawer
      }
    });
    return this.toApi(settings);
  }

  async updateInvoicing(tenantId: string, dto: UpdateInvoicingSettingsDto) {
    await this.ensure(tenantId);
    const settings = await this.prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        defaultTaxRate: dto.defaultTaxRate === undefined ? undefined : dto.defaultTaxRate / 100,
        maxDiscountRate: dto.maxDiscountRate === undefined ? undefined : dto.maxDiscountRate / 100,
        invoicePrefix: dto.invoicePrefix,
        quotePrefix: dto.quotePrefix,
        receiptPrefix: dto.receiptPrefix,
        posReceiptFormat: dto.posReceiptFormat,
        invoiceFormat: dto.invoiceFormat
      }
    });
    return this.toApi(settings);
  }

  private toApi(settings: TenantSettings) {
    return {
      ...settings,
      defaultTaxRate: Number(settings.defaultTaxRate ?? 0) * 100,
      maxDiscountRate: Number(settings.maxDiscountRate ?? 0) * 100
    };
  }

  private ensure(tenantId: string) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId }
    });
  }
}



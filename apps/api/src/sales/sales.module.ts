import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { InvoicePrintService } from "../print/invoice-print.service";
import { PdfService } from "../print/pdf.service";
import { ReceiptModule } from "../receipts/receipt.module";
import { StockModule } from "../stock/stock.module";
import { InvoicesModule } from "./invoices.module";
import { SalesPaymentsModule } from "./payments.module";
import { ProformasModule } from "./proformas.module";
import { QuotesModule } from "./quotes.module";
import { ReturnsModule } from "./returns.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [PrismaModule, StockModule, ReceiptModule, QuotesModule, ProformasModule, InvoicesModule, ReturnsModule, SalesPaymentsModule],
  controllers: [SalesController],
  providers: [SalesService, InvoicePrintService, PdfService],
  exports: [SalesService]
})
export class SalesModule {}
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { InvoicePrintService } from "../print/invoice-print.service";
import { PdfService } from "../print/pdf.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
@Module({ imports: [PrismaModule], controllers: [InvoicesController], providers: [InvoicesService, InvoicePrintService, PdfService], exports: [InvoicesService] })
export class InvoicesModule {}

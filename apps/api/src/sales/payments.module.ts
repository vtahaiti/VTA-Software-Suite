import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SalesPaymentsController } from "./payments.controller";
import { SalesPaymentsService } from "./payments.service";
@Module({ imports: [PrismaModule], controllers: [SalesPaymentsController], providers: [SalesPaymentsService] })
export class SalesPaymentsModule {}

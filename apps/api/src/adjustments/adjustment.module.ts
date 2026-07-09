import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { AdjustmentController } from "./adjustment.controller";
import { AdjustmentService } from "./adjustment.service";
@Module({ imports:[PrismaModule,StockModule], controllers:[AdjustmentController], providers:[AdjustmentService] })
export class AdjustmentModule {}
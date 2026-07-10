import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
@Module({ imports:[PrismaModule,StockModule], controllers:[InventoryController], providers:[InventoryService] })
export class InventoryModule {}
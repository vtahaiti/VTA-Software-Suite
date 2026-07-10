import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StoreWarehousesController } from "./store-warehouses.controller";
import { StoreTransfersController } from "./store-transfers.controller";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({ imports: [PrismaModule], controllers: [StoresController, StoreWarehousesController, StoreTransfersController], providers: [StoresService], exports: [StoresService] })
export class StoresModule {}
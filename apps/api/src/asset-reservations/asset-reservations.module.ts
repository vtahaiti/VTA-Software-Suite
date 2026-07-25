import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AssetReservationsController } from "./asset-reservations.controller";
import { AssetReservationsService } from "./asset-reservations.service";
@Module({ imports: [PrismaModule], controllers: [AssetReservationsController], providers: [AssetReservationsService], exports: [AssetReservationsService] })
export class AssetReservationsModule {}

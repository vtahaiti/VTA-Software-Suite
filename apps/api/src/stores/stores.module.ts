import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

// StoreWarehousesController (/store-warehouses) et StoreTransfersController (/store-transfers) ont
// ete retires du module : systeme d'entrepots/transferts duplique, remplace par /inventory/warehouses
// et /inventory/transfers, sans aucune reference cote frontend. Deja correctement proteges (tenant +
// permissions), donc ce n'etait pas une faille - juste une surface d'API morte. Fichiers conserves,
// simplement plus enregistres/routes.
@Module({ imports: [PrismaModule], controllers: [StoresController], providers: [StoresService], exports: [StoresService] })
export class StoresModule {}
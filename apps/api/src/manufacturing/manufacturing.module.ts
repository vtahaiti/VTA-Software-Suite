import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ManufacturingController } from "./manufacturing.controller";
import { ManufacturingService } from "./manufacturing.service";

@Module({ imports: [PrismaModule], controllers: [ManufacturingController], providers: [ManufacturingService], exports: [ManufacturingService] })
export class ManufacturingModule {}

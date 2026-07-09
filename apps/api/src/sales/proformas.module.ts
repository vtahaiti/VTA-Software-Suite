import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProformasController } from "./proformas.controller";
import { ProformasService } from "./proformas.service";
@Module({ imports: [PrismaModule], controllers: [ProformasController], providers: [ProformasService], exports: [ProformasService] })
export class ProformasModule {}

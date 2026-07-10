import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MovementController } from "./movement.controller";
import { MovementService } from "./movement.service";
@Module({ imports:[PrismaModule], controllers:[MovementController], providers:[MovementService] })
export class MovementModule {}
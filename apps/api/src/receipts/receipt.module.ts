import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ReceiptController } from "./receipt.controller";
import { ReceiptService } from "./receipt.service";
@Module({ imports:[PrismaModule], controllers:[ReceiptController], providers:[ReceiptService], exports:[ReceiptService] })
export class ReceiptModule {}
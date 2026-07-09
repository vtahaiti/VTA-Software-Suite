import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
@Module({ imports:[PrismaModule], controllers:[PaymentController], providers:[PaymentService] })
export class PaymentModule {}
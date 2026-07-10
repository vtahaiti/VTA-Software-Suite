import { Module } from "@nestjs/common";
import { CashRegisterModule } from "../cash-register/cash-register.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SalesModule } from "../sales/sales.module";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";

@Module({
  imports: [PrismaModule, SalesModule, CashRegisterModule],
  controllers: [PosController],
  providers: [PosService]
})
export class PosModule {}
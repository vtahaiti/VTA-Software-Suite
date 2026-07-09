import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CashRegisterService } from "./cash-register.service";
import { CloseCashSessionDto, CreateCashMovementDto, CreateCashRegisterDto, OpenCashSessionDto } from "./dto/create-cash-register.dto";

@UseGuards(JwtAuthGuard)
@Controller("cash-registers")
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Get()
  @Permissions("cash.read")
  registers(@Req() req: AuthenticatedRequest) { return this.service.registers(req.user.tenantId); }

  @Post()
  @Permissions("cash.create")
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCashRegisterDto) { return this.service.createRegister(req.user.tenantId, dto); }

  @Get("sessions")
  @Permissions("cash.read")
  sessions(@Req() req: AuthenticatedRequest) { return this.service.sessions(req.user.tenantId); }

  @Get("sessions/active")
  @Permissions("cash.read")
  active(@Req() req: AuthenticatedRequest) { return this.service.activeSession(req.user.tenantId); }

  @Post("sessions/open")
  @Permissions("cash.open")
  open(@Req() req: AuthenticatedRequest, @Body() dto: OpenCashSessionDto) { return this.service.open(req.user.tenantId, dto); }

  @Post("sessions/movements")
  @Permissions("cash.movement")
  movement(@Req() req: AuthenticatedRequest, @Body() dto: CreateCashMovementDto) { return this.service.movement(req.user.tenantId, dto); }

  @Get("sessions/:id/report")
  @Permissions("cash.report")
  report(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.service.report(req.user.tenantId, id); }

  @Post("sessions/:id/close")
  @Permissions("cash.close")
  close(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CloseCashSessionDto) { return this.service.close(req.user.tenantId, id, dto); }
}
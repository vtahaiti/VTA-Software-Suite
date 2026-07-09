import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateReturnDto } from "./dto/create-return.dto";
import { ReturnsService } from "./returns.service";
@UseGuards(JwtAuthGuard)
@Controller("sales-returns")
export class ReturnsController { constructor(private readonly service: ReturnsService) {}
  @Get() @Permissions("return.read") findAll(@Req() req: AuthenticatedRequest) { return this.service.findAll(req.user.tenantId); }
  @Post() @Permissions("return.create") create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReturnDto) { return this.service.create(req.user.tenantId, dto, req.user.id); }
}
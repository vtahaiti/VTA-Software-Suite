import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AdjustmentService } from "./adjustment.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
@UseGuards(JwtAuthGuard)
@Controller("adjustments")
export class AdjustmentController{constructor(private readonly service:AdjustmentService){}
 @Get() @Permissions("inventory.count") findAll(@Req() req:AuthenticatedRequest){return this.service.findAll(req.user.tenantId)}
 @Post() @Permissions("inventory.count") create(@Req() req:AuthenticatedRequest,@Body() dto:CreateAdjustmentDto){return this.service.create(req.user.tenantId,dto)}
}
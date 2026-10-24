import { RequiresFeature } from "../subscriptions/requires-feature.decorator";
import { SubscriptionFeatureGuard } from "../subscriptions/subscription-feature.guard";
import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { MovementQueryDto } from "./dto/movement-query.dto";
import { MovementService } from "./movement.service";
@RequiresFeature("INVENTORY")
@UseGuards(JwtAuthGuard, SubscriptionFeatureGuard)
@Controller("movements")
export class MovementController{constructor(private readonly service:MovementService){}
 @Get() @Permissions("inventory.audit") findAll(@Req() req:AuthenticatedRequest,@Query() query:MovementQueryDto){return this.service.findAll(req.user.tenantId,query)}
}
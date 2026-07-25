import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { AssetReservationsService } from "./asset-reservations.service";
import { AssetReservationStatusValue, AssetReservationTypeValue, CreateAssetReservationDto, ReturnAssetReservationDto } from "./dto/asset-reservation.dto";

@UseGuards(JwtAuthGuard)
@Controller("asset-reservations")
export class AssetReservationsController {
  constructor(private readonly service: AssetReservationsService) {}

  @Get()
  @Permissions("sales.read")
  list(@Req() req: AuthenticatedRequest, @Query("assetType") assetType: AssetReservationTypeValue, @Query("status") status?: AssetReservationStatusValue) {
    return this.service.list(req.user.tenantId, assetType, status);
  }

  @Post()
  @Permissions("sales.create")
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAssetReservationDto) {
    return this.service.create(req.user.tenantId, dto, req.user.id);
  }

  @Post(":id/return")
  @Permissions("sales.create")
  returnAsset(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: ReturnAssetReservationDto) {
    return this.service.returnAsset(req.user.tenantId, id, dto);
  }

  @Post(":id/cancel")
  @Permissions("sales.create")
  cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.service.cancel(req.user.tenantId, id);
  }
}

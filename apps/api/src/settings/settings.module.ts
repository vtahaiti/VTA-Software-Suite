import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyProfileService } from "./company-profile.service";
import { SettingsController } from "./settings.controller";
import { TenantSettingsService } from "./tenant-settings.service";
import { RestaurantStarterService } from "./restaurant-starter.service";

@Module({ imports: [PrismaModule], controllers: [SettingsController], providers: [CompanyProfileService, TenantSettingsService, RestaurantStarterService], exports: [CompanyProfileService, TenantSettingsService] })
export class SettingsModule {}

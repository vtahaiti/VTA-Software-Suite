import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsOptional } from "class-validator";

export class UpdateTenantSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

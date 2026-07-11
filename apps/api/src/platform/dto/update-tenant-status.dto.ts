import { TenantStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status!: TenantStatus;

  @IsOptional()
  @IsString()
  @MinLength(6)
  reason?: string;
}

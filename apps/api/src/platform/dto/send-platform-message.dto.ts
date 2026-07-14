import { IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendPlatformMessageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @IsOptional()
  @IsIn(["tenant", "tenants", "all-active"])
  recipient?: "tenant" | "tenants" | "all-active";

  @IsOptional()
  @IsBoolean()
  ownersOnly?: boolean;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsIn(["info", "success", "warning", "error", "urgent"])
  level?: "info" | "success" | "warning" | "error" | "urgent";

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  dedupKey?: string;
}

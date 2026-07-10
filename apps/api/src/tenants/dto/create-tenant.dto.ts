import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"])
  status?: "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED";

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  logoAlt?: string;

  @IsOptional()
  @IsIn(["FREE", "STARTER", "PRO", "ENTERPRISE"])
  subscriptionPlan?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
}
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const tenantRoleNames = ["OWNER", "ADMIN", "CAISSIER", "STOCK", "COMPTABLE", "MANAGER"] as const;
export type TenantRoleName = (typeof tenantRoleNames)[number];

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  temporaryPassword!: string;

  @IsIn(tenantRoleNames)
  role!: TenantRoleName;

  @IsOptional()
  @IsString()
  storeId?: string;
}

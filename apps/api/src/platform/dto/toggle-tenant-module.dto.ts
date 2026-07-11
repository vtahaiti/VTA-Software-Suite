import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class ToggleTenantModuleDto {
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  reason?: string;
}

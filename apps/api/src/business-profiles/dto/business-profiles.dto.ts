import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ActivateBusinessProfileDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ToggleBusinessModuleDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateBusinessSelectionDto {
  @IsString()
  @IsNotEmpty()
  businessCategory!: string;

  @IsString()
  @IsNotEmpty()
  primaryActivity!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryActivities?: string[];
}
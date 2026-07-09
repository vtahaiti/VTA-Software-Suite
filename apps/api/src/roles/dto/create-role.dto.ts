import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds?: string[];
}
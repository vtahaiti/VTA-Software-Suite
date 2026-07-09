import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreatePermissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
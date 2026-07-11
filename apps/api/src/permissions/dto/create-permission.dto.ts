import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreatePermissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/, { message: "La cle de permission doit utiliser le format module.action en minuscules." })
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
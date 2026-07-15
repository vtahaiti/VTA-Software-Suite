import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  temporaryPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  newPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password?: string;
}

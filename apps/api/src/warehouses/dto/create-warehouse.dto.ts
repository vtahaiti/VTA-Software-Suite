import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
export class CreateWarehouseDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
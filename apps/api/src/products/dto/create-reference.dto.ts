import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateReferenceDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(40) symbol?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

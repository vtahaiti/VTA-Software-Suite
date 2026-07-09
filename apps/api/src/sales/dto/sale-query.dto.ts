import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
export class SaleQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Transform(({ value }) => Number(value ?? 1)) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Transform(({ value }) => Number(value ?? 20)) @IsInt() @Min(1) limit?: number = 20;
}
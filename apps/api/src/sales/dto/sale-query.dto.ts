import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
export class SaleQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value) @IsBoolean() excludeTestData?: boolean;
  @IsOptional() @Transform(({ value }) => Number(value ?? 1)) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Transform(({ value }) => Number(value ?? 20)) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

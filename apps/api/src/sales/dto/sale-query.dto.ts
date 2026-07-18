import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
export class SaleQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() cashierId?: string;
  @IsOptional() @IsIn(["today", "week", "month", "custom"]) period?: "today" | "week" | "month" | "custom";
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value) @IsBoolean() excludeTestData?: boolean;
  @IsOptional() @Transform(({ value }) => Number(value ?? 1)) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Transform(({ value }) => Number(value ?? 20)) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

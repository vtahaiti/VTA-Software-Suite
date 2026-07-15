import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ProductQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() unitId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value) @IsBoolean() costMissing?: boolean;
  @IsOptional() @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value) @IsBoolean() isActive?: boolean;
  @IsOptional() @Transform(({ value }) => Number(value ?? 1)) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Transform(({ value }) => Number(value ?? 20)) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsIn(["name", "sku", "salePrice", "createdAt"]) sortBy?: "name" | "sku" | "salePrice" | "createdAt" = "createdAt";
  @IsOptional() @IsIn(["asc", "desc"]) sortOrder?: "asc" | "desc" = "desc";
}

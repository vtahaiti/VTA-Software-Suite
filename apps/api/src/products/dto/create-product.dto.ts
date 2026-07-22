import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class BarcodeDto {
  @IsString()
  value!: string;

  @IsIn(["UPC", "EAN", "QR", "CUSTOM"])
  type!: "UPC" | "EAN" | "QR" | "CUSTOM";

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ProductImageDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class ProductVariantDto {
  @IsString()
  name!: string;

  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() capacity?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
}

export class CreateProductDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() unitId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() subCategory?: string;
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() qrCode?: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
  @IsOptional() @IsNumber() @Min(0) salePrice?: number;
  @IsOptional() @IsNumber() @Min(0) promotionalPrice?: number;
  @IsOptional() @IsNumber() @Min(0) wholesalePrice?: number;
  @IsOptional() @IsNumber() @Min(0) averageCost?: number;
  @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsNumber() @Min(0) minimumStock?: number;
  @IsOptional() @IsNumber() @Min(0) stockInitial?: number;
  @IsOptional() @IsBoolean() trackStock?: boolean;
  @IsOptional() @IsNumber() @Min(0) maximumStock?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsDateString() manufacturingDate?: string;
  @IsOptional() @IsDateString() expirationDate?: string;
  @IsOptional() @IsNumber() @Min(0) warrantyMonths?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BarcodeDto) barcodes?: BarcodeDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductImageDto) images?: ProductImageDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantDto) variants?: ProductVariantDto[];
}

import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class PosCartItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  customId?: string;

  @IsOptional()
  @IsString()
  customName?: string;

  @IsOptional()
  @IsIn(["OUT_OF_STOCK_PRODUCT", "SERVICE", "CUSTOM_WORK", "OTHER"])
  customType?: "OUT_OF_STOCK_PRODUCT" | "SERVICE" | "CUSTOM_WORK" | "OTHER";

  @IsOptional()
  @IsString()
  customNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;
}

export class PosCartDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosCartItemDto)
  items!: PosCartItemDto[];
}

export class PosCartAddDto extends PosCartDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class PosCartUpdateDto extends PosCartDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class PosCartRemoveDto extends PosCartDto {
  @IsString()
  productId!: string;
}

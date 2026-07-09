import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class PosCartItemDto {
  @IsString()
  productId!: string;

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

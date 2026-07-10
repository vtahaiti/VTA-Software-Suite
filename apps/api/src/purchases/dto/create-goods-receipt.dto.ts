import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class CreateGoodsReceiptItemDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateGoodsReceiptDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items!: CreateGoodsReceiptItemDto[];
}
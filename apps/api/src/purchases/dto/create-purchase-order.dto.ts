import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class CreatePurchaseOrderItemDto {
  @IsString() @IsNotEmpty() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitCost!: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) tax?: number;
}

export class CreatePurchaseOrderDto {
  @IsString() @IsNotEmpty() supplierId!: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreatePurchaseOrderItemDto) items!: CreatePurchaseOrderItemDto[];
}

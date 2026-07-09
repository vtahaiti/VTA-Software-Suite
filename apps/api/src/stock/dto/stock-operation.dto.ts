import { IsInt, IsOptional, IsString, Min } from "class-validator";
export class StockOperationDto {
  @IsString() productId!: string;
  @IsString() warehouseId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() storeId?: string;
}

export class StockAdjustDto {
  @IsString() productId!: string;
  @IsString() warehouseId!: string;
  @IsInt() @Min(0) quantity!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() storeId?: string;
}

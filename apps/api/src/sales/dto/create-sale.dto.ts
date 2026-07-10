import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
export class SaleItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() customId?: string;
  @IsOptional() @IsString() customName?: string;
  @IsOptional() @IsIn(["OUT_OF_STOCK_PRODUCT", "SERVICE", "CUSTOM_WORK", "OTHER"]) customType?: "OUT_OF_STOCK_PRODUCT" | "SERVICE" | "CUSTOM_WORK" | "OTHER";
  @IsOptional() @IsString() customNote?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discount?: number;
}
class PaymentDto { @IsIn(["CASH", "CARD", "BANK_TRANSFER", "MIXED"]) method!: "CASH" | "CARD" | "BANK_TRANSFER" | "MIXED"; @Type(() => Number) @IsNumber() @Min(0) amount!: number; @IsOptional() @IsString() reference?: string; }
export class CreateSaleDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() cashSessionId?: string;
    @IsOptional() @IsString() storeId?: string;
  @IsString() warehouseId!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsString() note?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items!: SaleItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentDto) payments?: PaymentDto[];
}

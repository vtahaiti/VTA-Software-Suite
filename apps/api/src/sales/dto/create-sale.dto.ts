import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
class SaleItemDto { @IsString() productId!: string; @IsInt() @Min(1) quantity!: number; @IsOptional() @IsNumber() @Min(0) discount?: number; }
class PaymentDto { @IsIn(["CASH", "CARD", "BANK_TRANSFER", "MIXED"]) method!: "CASH" | "CARD" | "BANK_TRANSFER" | "MIXED"; @IsNumber() @Min(0) amount!: number; @IsOptional() @IsString() reference?: string; }
export class CreateSaleDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() cashSessionId?: string;
    @IsOptional() @IsString() storeId?: string;
  @IsString() warehouseId!: string;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsString() note?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items!: SaleItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentDto) payments?: PaymentDto[];
}

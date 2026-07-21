import { PaymentMethod, SalesDocumentStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class SalesDocumentItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  customName?: string;

  @IsOptional()
  @IsString()
  customType?: string;

  @IsOptional()
  @IsString()
  customNote?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;
}

export class CreateSalesDocumentDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesDocumentItemDto)
  items!: SalesDocumentItemDto[];
}

export class UpdateSalesDocumentDto extends CreateSalesDocumentDto {}

export class SalesDocumentQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class CreateInvoicePaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSalesDocumentStatusDto {
  @IsEnum(SalesDocumentStatus)
  status!: SalesDocumentStatus;
}

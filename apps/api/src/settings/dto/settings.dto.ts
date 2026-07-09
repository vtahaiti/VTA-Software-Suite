import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateCompanyProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() timezone?: string;
}

export class UpdateInvoicingSettingsDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) defaultTaxRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) maxDiscountRate?: number;
  @IsOptional() @IsString() invoicePrefix?: string;
  @IsOptional() @IsString() quotePrefix?: string;
  @IsOptional() @IsString() receiptPrefix?: string;
  @IsOptional() @IsIn(["58", "80"]) posReceiptFormat?: "58" | "80";
  @IsOptional() @IsIn(["A4", "LETTER"]) invoiceFormat?: "A4" | "LETTER";
}

export class UpdatePosSettingsDto {
  @IsOptional() @IsBoolean() allowNegativeStock?: boolean;
  @IsOptional() @IsBoolean() allowDiscount?: boolean;
  @IsOptional() @IsBoolean() requireCustomer?: boolean;
  @IsOptional() @IsBoolean() autoPrintReceipt?: boolean;
  @IsOptional() @IsBoolean() openCashDrawer?: boolean;
}

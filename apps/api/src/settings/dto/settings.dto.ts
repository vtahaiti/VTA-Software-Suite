import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Matches, Max, Min } from "class-validator";

const emptyToNull = ({ value }: { value: unknown }) => typeof value === "string" && value.trim() === "" ? null : value;

export class UpdateCompanyProfileDto {
  @Transform(emptyToNull) @IsOptional() @IsString() name?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() companyName?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() primaryColor?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() @Matches(/^(?!data:).*/i, { message: "Le logo doit etre envoye avec le bouton upload, pas dans le formulaire." }) logoUrl?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() phone?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() whatsapp?: string;
  @Transform(emptyToNull) @IsOptional() @IsEmail({}, { message: "Veuillez saisir une adresse email valide." }) email?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() address?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() city?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() country?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() taxNumber?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() currency?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() language?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() timezone?: string;
}

export class UpdateInvoicingSettingsDto {
  @IsOptional() @IsBoolean() taxEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) defaultTaxRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) maxDiscountRate?: number;
  @Transform(emptyToNull) @IsOptional() @IsString() invoicePrefix?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() quotePrefix?: string;
  @Transform(emptyToNull) @IsOptional() @IsString() receiptPrefix?: string;
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



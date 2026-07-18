import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export const STOCK_OUT_REASONS = [
  "CASSE",
  "PERTE",
  "VOL",
  "EXPIRATION",
  "REPAS_PERSONNEL",
  "UTILISATION_INTERNE",
  "CORRECTION_INVENTAIRE",
  "RETOUR_FOURNISSEUR",
  "AUTRE"
] as const;

export type StockOutReason = typeof STOCK_OUT_REASONS[number];

export class StockOperationDto {
  @IsString() productId!: string;
  @IsString() warehouseId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsIn(STOCK_OUT_REASONS) reason?: StockOutReason;
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

import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export const ASSET_RESERVATION_TYPES = ["VEHICLE", "ROOM"] as const;
export type AssetReservationTypeValue = typeof ASSET_RESERVATION_TYPES[number];

export const ASSET_RESERVATION_STATUSES = ["ACTIVE", "RETURNED", "CANCELLED"] as const;
export type AssetReservationStatusValue = typeof ASSET_RESERVATION_STATUSES[number];

export class CreateAssetReservationDto {
  @IsString() productId!: string;
  @IsString() customerId!: string;
  @IsIn(ASSET_RESERVATION_TYPES) assetType!: AssetReservationTypeValue;
  @IsOptional() @IsDateString() startDate?: string;
  @IsDateString() expectedEndDate!: string;
  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsNumber() @Min(0) deposit?: number;
  @IsOptional() @IsString() note?: string;
}

export class ReturnAssetReservationDto {
  @IsOptional() @IsString() note?: string;
}

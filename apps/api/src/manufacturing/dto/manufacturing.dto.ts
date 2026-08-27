import { ManufacturingOrderStatus, ManufacturingPriority } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class ManufacturingQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ManufacturingOrderStatus) status?: ManufacturingOrderStatus;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

export class CreateManufacturingOrderDto {
  @IsString() warehouseId!: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ManufacturingPriority) priority?: ManufacturingPriority;
  @IsOptional() @IsString() instructions?: string;
}

export class UpdateManufacturingOrderDto {
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsEnum(ManufacturingPriority) priority?: ManufacturingPriority;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsString() notes?: string;
}

export class AddManufacturingMaterialDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() manufacturingItemId?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) requiredQuantity!: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost?: number;
  @IsOptional() @IsString() notes?: string;
}

export class ReadyManufacturingDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) wasteQuantity?: number;
}

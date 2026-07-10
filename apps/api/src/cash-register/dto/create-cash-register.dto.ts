import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateCashRegisterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OpenCashSessionDto {
  @IsString()
  cashRegisterId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingAmount!: number;
}

export class CloseCashSessionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingAmount!: number;
}

export class CreateCashMovementDto {
  @IsString()
  cashSessionId!: string;

  @IsIn(["IN", "OUT"])
  type!: "IN" | "OUT";

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
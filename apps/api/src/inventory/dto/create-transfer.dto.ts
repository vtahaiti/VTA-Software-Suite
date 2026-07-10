import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
class TransferItemDto { @IsString() productId!: string; @IsInt() @Min(1) quantity!: number; }
export class CreateTransferDto {
  @IsString() fromWarehouseId!: string;
  @IsString() toWarehouseId!: string;
  @IsOptional() @IsString() note?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TransferItemDto) items!: TransferItemDto[];
}
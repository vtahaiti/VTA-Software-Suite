import { IsArray, IsInt, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
class AdjustmentItemDto { @IsString() productId!: string; @IsInt() @Min(0) countedQty!: number; }
export class CreateAdjustmentDto {
  @IsString() warehouseId!: string;
  @IsString() reason!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => AdjustmentItemDto) items!: AdjustmentItemDto[];
}
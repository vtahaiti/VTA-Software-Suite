import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class ProductionItemDto {
  @IsString() productId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class ProductionDto {
  @IsString() warehouseId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ProductionItemDto) inputs!: ProductionItemDto[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ProductionItemDto) outputs!: ProductionItemDto[];
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}

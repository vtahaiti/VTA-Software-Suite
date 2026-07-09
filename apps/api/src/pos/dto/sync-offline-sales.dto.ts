import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreateSaleDto } from "../../sales/dto/create-sale.dto";

export class OfflineSaleDto extends CreateSaleDto {
  @IsString()
  localId!: string;

  @IsOptional()
  @IsString()
  createdOfflineAt?: string;
}

export class SyncOfflineSalesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineSaleDto)
  sales!: OfflineSaleDto[];
}

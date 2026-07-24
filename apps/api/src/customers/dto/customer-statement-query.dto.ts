import { IsOptional, IsString } from "class-validator";

export class CustomerStatementQueryDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

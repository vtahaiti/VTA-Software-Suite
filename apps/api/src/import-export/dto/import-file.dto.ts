import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class ImportFileDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  contentBase64?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsIn(["CSV", "EXCEL", "XLSX"])
  format?: "CSV" | "EXCEL" | "XLSX";

  @IsOptional()
  @IsObject()
  mapping?: Record<string, string>;

  @IsOptional()
  @IsIn(["ignore", "update"])
  duplicateStrategy?: "ignore" | "update";
}


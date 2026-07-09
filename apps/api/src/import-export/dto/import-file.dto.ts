import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class ImportFileDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsIn(["CSV", "EXCEL"])
  format?: "CSV" | "EXCEL";
}
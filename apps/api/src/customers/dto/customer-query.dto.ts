import { CustomerStatus, CustomerType } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CustomerQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsIn(["customerCode", "displayName", "company", "phone", "email", "city", "currentBalance", "status", "createdAt", "updatedAt"])
  sortBy?: string = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
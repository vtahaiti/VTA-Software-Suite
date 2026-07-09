import { IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateSupplierDto {
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) country?: string;
  @IsOptional() @IsString() @MaxLength(80) taxNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) primaryContact?: string;
  @IsOptional() @IsString() @MaxLength(120) paymentTerms?: string;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsIn(["ACTIVE", "INACTIVE"]) status?: "ACTIVE" | "INACTIVE";
  @IsOptional() @IsNumber() @Min(0) balance?: number;
  @IsOptional() @IsString() notes?: string;
}

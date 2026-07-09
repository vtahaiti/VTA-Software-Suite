import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCompanyDto {
  @IsString() @IsNotEmpty() pendingToken!: string;
  @IsString() @IsNotEmpty() companyName!: string;
  @IsString() @IsNotEmpty() businessCategory!: string;
  @IsString() @IsNotEmpty() primaryActivity!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) secondaryActivities?: string[];
  @IsOptional() @IsString() businessProfileSlug?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() secondaryColor?: string;
  @IsOptional() @IsString() logoDataUrl?: string;
  @IsOptional() @IsString() userPhotoDataUrl?: string;
}
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterUserDto {
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(8) confirmPassword!: string;
  @IsBoolean() acceptedTerms!: boolean;
}
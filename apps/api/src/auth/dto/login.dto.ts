import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Email invalide" })
  email!: string;

  @IsString({ message: "Le mot de passe est obligatoire" })
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caracteres" })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: "Remember me doit etre un booleen" })
  rememberMe?: boolean;
}
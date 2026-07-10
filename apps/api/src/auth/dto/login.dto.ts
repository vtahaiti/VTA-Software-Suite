import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Email invalide" })
  email!: string;

  @IsString({ message: "Le mot de passe est obligatoire" })
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères" })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: "Remember me doit être un booléen" })
  rememberMe?: boolean;
}

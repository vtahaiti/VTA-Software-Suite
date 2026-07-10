import { IsString, Matches, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString({ message: "Le token de réinitialisation est obligatoire." })
  token!: string;

  @IsString({ message: "Le mot de passe est obligatoire." })
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial."
  })
  password!: string;

  @IsString({ message: "La confirmation du mot de passe est obligatoire." })
  confirmPassword!: string;
}

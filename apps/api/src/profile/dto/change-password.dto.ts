import { IsString, Matches, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString({ message: "Le mot de passe actuel est obligatoire." })
  currentPassword!: string;

  @IsString({ message: "Le nouveau mot de passe est obligatoire." })
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial."
  })
  newPassword!: string;
}

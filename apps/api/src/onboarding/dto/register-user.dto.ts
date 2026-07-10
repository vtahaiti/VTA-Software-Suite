import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail({}, { message: "Veuillez saisir une adresse email valide." })
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString({ message: "Le mot de passe est obligatoire." })
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial."
  })
  password!: string;

  @IsString({ message: "La confirmation du mot de passe est obligatoire." })
  @MinLength(8, { message: "La confirmation du mot de passe doit contenir au moins 8 caractères." })
  confirmPassword!: string;

  @IsBoolean()
  @Equals(true, { message: "Vous devez accepter les conditions d’utilisation et la politique de confidentialité." })
  acceptedTerms!: boolean;
}

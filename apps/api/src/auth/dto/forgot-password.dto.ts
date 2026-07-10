import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Veuillez saisir une adresse email valide." })
  email!: string;
}

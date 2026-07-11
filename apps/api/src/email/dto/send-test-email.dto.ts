import { IsEmail, IsOptional } from "class-validator";

export class SendTestEmailDto {
  @IsOptional()
  @IsEmail({}, { message: "Veuillez saisir une adresse email valide." })
  to?: string;
}
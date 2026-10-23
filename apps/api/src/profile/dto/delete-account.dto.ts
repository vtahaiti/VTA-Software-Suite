import { Equals, IsEmail, IsString, MaxLength } from "class-validator";

export class DeleteAccountDto {
  @IsString()
  @MaxLength(256)
  currentPassword!: string;

  @Equals("SUPPRIMER")
  confirmation!: string;
}

export class DeleteAccountWithPasswordDto extends DeleteAccountDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

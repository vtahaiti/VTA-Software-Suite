import { IsNotEmpty, IsString } from "class-validator";

export class CreatePlatformNoteDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}

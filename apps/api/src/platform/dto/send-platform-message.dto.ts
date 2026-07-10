import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendPlatformMessageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

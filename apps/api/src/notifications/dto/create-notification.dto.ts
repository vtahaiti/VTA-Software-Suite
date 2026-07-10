import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateNotificationDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  message!: string;

  @IsOptional()
  @IsIn(["info", "success", "warning", "error"])
  type?: "info" | "success" | "warning" | "error";

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
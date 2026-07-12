import { IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateNotificationDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  role?: string;

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

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  dedupKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

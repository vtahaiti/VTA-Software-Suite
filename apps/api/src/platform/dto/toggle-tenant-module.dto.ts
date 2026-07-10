import { IsBoolean } from "class-validator";

export class ToggleTenantModuleDto {
  @IsBoolean()
  isActive!: boolean;
}

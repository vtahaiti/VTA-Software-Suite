import { IsIn } from "class-validator";
import { tenantRoleNames, type TenantRoleName } from "./create-user.dto";

export class UpdateUserRoleDto {
  @IsIn(tenantRoleNames)
  role!: TenantRoleName;
}

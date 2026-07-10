import type { Request } from "express";
import type { AuthUser } from "../../auth/types/auth-user";

export type TenantContextRequest = Request & {
  user?: AuthUser;
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
  };
};
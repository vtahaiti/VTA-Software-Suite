export type AuthUser = {
  id: string;
  sessionId: string;
  tenantId: string;
  tenant: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  createdAt: string;
};
import type { Request } from "express";
import type { AuthUser } from "./auth-user";

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};
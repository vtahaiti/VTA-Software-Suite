import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthService } from "../auth.service";

@Injectable()
export class AuthenticationMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(request: Request & { user?: unknown }, _response: Response, next: NextFunction) {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];

    if (type === "Bearer" && token) {
      try {
        request.user = await this.authService.verifyAccessToken(token);
      } catch {
        request.user = undefined;
      }
    }

    next();
  }
}
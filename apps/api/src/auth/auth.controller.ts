import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "./types/authenticated-request";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    this.setRefreshCookie(response, result.refreshToken, loginDto.rememberMe);
    return result;
  }

  @Post("refresh")
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = refreshTokenDto.refreshToken ?? request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException("Session expiree");
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(response, result.refreshToken, result.rememberMe);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.user.sessionId, request.user, this.clientMeta(request));
    response.clearCookie("refreshToken");
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }

  private clientMeta(request: Request) {
    return { ipAddress: request.ip, userAgent: request.headers["user-agent"] };
  }

  private setRefreshCookie(response: Response, refreshToken: string, rememberMe?: boolean) {
    response.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });
  }
}
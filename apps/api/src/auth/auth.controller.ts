import { Body, Controller, ForbiddenException, Get, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "./types/authenticated-request";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() loginDto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto, this.clientMeta(request));
    this.setRefreshCookie(response, result.refreshToken, loginDto.rememberMe);
    return result;
  }

  @Post("platform/login")
  async platformLogin(@Body() loginDto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginPlatformAdmin(loginDto, this.clientMeta(request));
    this.setPlatformRefreshCookie(response, result.refreshToken, loginDto.rememberMe);
    return result;
  }

  @Post("forgot-password")
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.requestPasswordReset(forgotPasswordDto, this.clientMeta(request));
  }

  @Post("reset-password")
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
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

  @Post("platform/refresh")
  async platformRefresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = refreshTokenDto.refreshToken ?? request.cookies?.platformRefreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException("Session plateforme expiree");
    }
    const result = await this.authService.refreshPlatform(refreshToken);
    this.setPlatformRefreshCookie(response, result.refreshToken, result.rememberMe);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post("platform/logout")
  async platformLogout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    this.assertPlatformUser(request);
    await this.authService.logout(request.user.sessionId, request.user, this.clientMeta(request));
    response.clearCookie("platformRefreshToken");
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("platform/me")
  platformMe(@Req() request: AuthenticatedRequest) {
    this.assertPlatformUser(request);
    return { user: request.user };
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
    const forwarded = request.headers["x-forwarded-for"];
    const ipAddress = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : request.ip;
    return { ipAddress, userAgent: request.headers["user-agent"] };
  }

  private setRefreshCookie(response: Response, refreshToken: string, rememberMe?: boolean) {
    response.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });
  }

  private setPlatformRefreshCookie(response: Response, refreshToken: string, rememberMe?: boolean) {
    response.cookie("platformRefreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });
  }

  private assertPlatformUser(request: AuthenticatedRequest) {
    const audience = request.user.audience ?? request.user.aud;
    const hasPlatformAudience = audience === "platform" || (Array.isArray(audience) && audience.includes("platform"));
    const roles = request.user.roles ?? [request.user.role].filter(Boolean);
    const hasPlatformRole = roles.some((role) => role === "SUPER_ADMIN" || role === "PlatformAdmin");
    if (!hasPlatformAudience || request.user.iss !== (process.env.JWT_ISSUER ?? "vtaerp.com") || !hasPlatformRole) {
      throw new ForbiddenException("Session plateforme requise");
    }
  }
}

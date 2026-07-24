import { Body, Controller, Get, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ProfileService } from "./profile.service";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return this.profile.me(request.user.id);
  }

  @Patch("me")
  update(@Req() request: AuthenticatedRequest, @Body() body: { name?: string; jobTitle?: string; phone?: string; language?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return this.profile.update(request.user.id, body);
  }

  @Post("photo")
  photo(@Req() request: AuthenticatedRequest, @Body() body: { photoUrl?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return this.profile.updatePhoto(request.user.id, body.photoUrl ?? "");
  }

  @Patch("password")
  changePassword(@Req() request: AuthenticatedRequest, @Body() body: ChangePasswordDto) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return this.profile.changePassword(request.user.id, body);
  }
}
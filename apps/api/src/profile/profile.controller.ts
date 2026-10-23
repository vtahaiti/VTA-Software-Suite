import { Body, Controller, Delete, Get, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto, DeleteAccountWithPasswordDto } from "./dto/delete-account.dto";
import { AuthService } from "../auth/auth.service";
import { ProfileService } from "./profile.service";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService, private readonly auth: AuthService) {}

  @Post("delete-account")
  async deleteWithPassword(@Req() request: AuthenticatedRequest, @Body() body: DeleteAccountWithPasswordDto) {
    const userId = await this.auth.authorizeAccountDeletion(body.email, body.currentPassword, {
      ipAddress: request.ip, userAgent: request.headers["user-agent"]
    });
    return this.profile.deleteAccount(userId, body);
  }

  @Delete("me")
  deleteAccount(@Req() request: AuthenticatedRequest, @Body() body: DeleteAccountDto) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return this.profile.deleteAccount(request.user.id, body);
  }

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
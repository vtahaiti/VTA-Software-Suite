import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("company-logo")
  companyLogo(@Req() request: AuthenticatedRequest, @Body() body: { dataUrl?: string; fileName?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return { url: this.uploads.saveDataUrl("tenants", body.dataUrl) ?? this.uploads.normalizeUploadedName("tenants", body.fileName) };
  }

  @Post("user-photo")
  userPhoto(@Req() request: AuthenticatedRequest, @Body() body: { dataUrl?: string; fileName?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    return { url: this.uploads.saveDataUrl("users", body.dataUrl) ?? this.uploads.normalizeUploadedName("users", body.fileName) };
  }
}
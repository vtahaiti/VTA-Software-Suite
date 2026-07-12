import { Body, Controller, Post, Req, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("company-logo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  companyLogo(@Req() request: AuthenticatedRequest, @UploadedFile() file?: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }, @Body() body?: { dataUrl?: string; fileName?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    if (file) return { url: this.uploads.saveImageFile("tenants", file) };
    return { url: this.uploads.saveDataUrl("tenants", body?.dataUrl) ?? this.uploads.normalizeUploadedName("tenants", body?.fileName) };
  }

  @Post("user-photo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  userPhoto(@Req() request: AuthenticatedRequest, @UploadedFile() file?: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }, @Body() body?: { dataUrl?: string; fileName?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    if (file) return { url: this.uploads.saveImageFile("users", file) };
    return { url: this.uploads.saveDataUrl("users", body?.dataUrl) ?? this.uploads.normalizeUploadedName("users", body?.fileName) };
  }
}

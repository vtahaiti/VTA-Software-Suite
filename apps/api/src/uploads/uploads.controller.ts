import { BadRequestException, Body, Controller, Post, Req, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService, private readonly prisma: PrismaService) {}

  @Post("company-logo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  async companyLogo(@Req() request: AuthenticatedRequest, @UploadedFile() file?: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }, @Body() body?: { dataUrl?: string; fileName?: string; pendingToken?: string }) {
    if (!request.user) {
      const token = body?.pendingToken?.trim();
      if (!token) throw new UnauthorizedException("Session requise");
      const pending = await this.prisma.pendingRegistration.findUnique({ where: { token }, select: { expiresAt: true } });
      if (!pending || pending.expiresAt.getTime() < Date.now()) throw new UnauthorizedException("Session d'inscription expiree.");
    }
    if (file) return { url: this.uploads.saveImageFile("tenants", file) };
    if (body?.dataUrl) throw new BadRequestException("Le logo entreprise doit etre envoye comme fichier.");
    return { url: this.uploads.normalizeUploadedName("tenants", body?.fileName) };
  }

  @Post("user-photo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  userPhoto(@Req() request: AuthenticatedRequest, @UploadedFile() file?: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }, @Body() body?: { dataUrl?: string; fileName?: string }) {
    if (!request.user) throw new UnauthorizedException("Session requise");
    if (file) return { url: this.uploads.saveImageFile("users", file) };
    return { url: this.uploads.saveDataUrl("users", body?.dataUrl) ?? this.uploads.normalizeUploadedName("users", body?.fileName) };
  }
}

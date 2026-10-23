import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { comparePassword, hashPassword } from "../auth/password-hashing";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { AuthService } from "../auth/auth.service";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { PrismaService } from "../prisma/prisma.service";
import { ChangePasswordDto } from "./dto/change-password.dto";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    // Delete only the authenticated identity. Shared business records belong to the
    // company and remain available to its other users; they are never cascade-deleted.
    if (dto.confirmation !== "SUPPRIMER") throw new BadRequestException("Confirmation requise.");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !await comparePassword(dto.currentPassword, user.password)) {
      throw new BadRequestException("Mot de passe incorrect.");
    }
    // Erase identifying data instead of leaving a recoverable, disabled account.
    // A tombstone preserves the IDs in legally retained sales/audit references.
    const erasedPassword = await hashPassword(randomBytes(48).toString("hex"));
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: {
        isActive: false, name: "Utilisateur supprimé",
        email: `deleted+${userId}@deleted.vtaerp.invalid`, password: erasedPassword
      } });
      await tx.userProfile.deleteMany({ where: { userId } });
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.onboardingState.deleteMany({ where: { userId } });
      await tx.pendingRegistration.deleteMany({ where: { email: user.email } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.emailLog.deleteMany({ where: { userId } });
      await tx.storeUser.deleteMany({ where: { userId } });
      await tx.auditLog.updateMany({ where: { userId }, data: {
        userEmail: null, userName: "Utilisateur supprimé", userPhotoUrl: null,
        oldValue: Prisma.DbNull, newValue: Prisma.DbNull, metadata: Prisma.DbNull,
        ipAddress: null, userAgent: null, browser: null, operatingSystem: null
      } });
      await tx.securityLog.deleteMany({ where: { userId } });
    });
    this.auth.invalidateUserSessions(userId);
    return { deleted: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { include: { companyProfile: true, logo: true, settings: true } }, profile: true, roles: { include: { role: true } } }
    });
    if (!user) throw new NotFoundException("Profil introuvable");
    return {
      id: user.id,
      name: user.name,
      firstName: user.name.split(" ")[0] ?? user.name,
      lastName: user.name.split(" ").slice(1).join(" "),
      email: user.email,
      role: user.roles[0]?.role.name ?? "Owner",
      tenant: {
        id: user.tenantId,
        name: user.tenant.name,
        companyProfile: user.tenant.companyProfile
          ? { ...user.tenant.companyProfile, logoUrl: user.tenant.companyProfile.logoUrl ?? user.tenant.logo?.url ?? null }
          : { logoUrl: user.tenant.logo?.url ?? null }
      },
      profile: user.profile,
      createdAt: user.createdAt
    };
  }

  async update(userId: string, dto: { name?: string; jobTitle?: string; phone?: string; language?: string }) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name: dto.name }, include: { profile: true } });
    await this.prisma.userProfile.upsert({
      where: { userId },
      update: { jobTitle: dto.jobTitle, phone: dto.phone, language: dto.language ?? user.profile?.language ?? "fr" },
      create: { userId, jobTitle: dto.jobTitle, phone: dto.phone, language: dto.language ?? "fr" }
    });
    return this.me(userId);
  }

  async updatePhoto(userId: string, photoUrl: string) {
    await this.prisma.userProfile.upsert({ where: { userId }, update: { photoUrl }, create: { userId, photoUrl } });
    return this.me(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, password: true } });
    if (!user) throw new NotFoundException("Profil introuvable");
    const currentPasswordValid = await comparePassword(dto.currentPassword, user.password);
    if (!currentPasswordValid) throw new BadRequestException("Mot de passe actuel incorrect.");
    await this.prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(dto.newPassword) } });
    return { success: true };
  }
}

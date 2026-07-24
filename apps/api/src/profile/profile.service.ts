import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { comparePassword, hashPassword } from "../auth/password-hashing";
import { PrismaService } from "../prisma/prisma.service";
import { ChangePasswordDto } from "./dto/change-password.dto";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

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

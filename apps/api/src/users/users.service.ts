import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { hashPassword } from "../auth/password-hashing";
import { PrismaService } from "../prisma/prisma.service";
import { defaultPermissions } from "../rbac/default-permissions";
import { CreateUserDto, tenantRoleNames, type TenantRoleName } from "./dto/create-user.dto";
import { tenantRolePresets } from "./tenant-role-presets";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly authService: AuthService) {}

  async findAll(tenantId: string) {
    await this.ensureTenantRolePresets(tenantId);
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: { profile: true, roles: { include: { role: true } }, tenant: { select: { name: true } } },
      orderBy: { createdAt: "asc" }
    });
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.profile?.phone ?? "",
      isActive: user.isActive,
      roles: user.roles.map((entry) => entry.role.name),
      role: user.roles[0]?.role.name ?? "Aucun rôle",
      tenant: user.tenant.name,
      createdAt: user.createdAt
    }));
  }

  async create(tenantId: string, dto: CreateUserDto) {
    await this.ensureTenantRolePresets(tenantId);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { tenantId, email } });
    if (existing) throw new ConflictException("Un utilisateur existe déjà avec cet email dans cette entreprise.");

    const role = await this.roleOrFail(tenantId, dto.role);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        name: dto.name.trim(),
        password: await hashPassword(dto.temporaryPassword),
        isActive: true,
        roles: { create: { roleId: role.id } },
        profile: { create: { phone: dto.phone, jobTitle: this.roleJobTitle(dto.role), language: "fr" } }
      },
      include: { roles: { include: { role: true } } }
    });

    if (dto.storeId) {
      const store = await this.prisma.store.findFirst({ where: { id: dto.storeId, tenantId } });
      if (store) {
        await this.prisma.storeUser.upsert({
          where: { storeId_userId: { storeId: store.id, userId: user.id } },
          update: { role: dto.role, isActive: true },
          create: { tenantId, storeId: store.id, userId: user.id, role: dto.role, isActive: true }
        });
      }
    }

    return { id: user.id, name: user.name, email: user.email, role: user.roles[0]?.role.name, isActive: user.isActive };
  }

  async updateRole(tenantId: string, userId: string, roleName: TenantRoleName) {
    const user = await this.userOrFail(tenantId, userId);
    this.assertNotPlatformUser(user);
    const role = await this.roleOrFail(tenantId, roleName);
    await this.prisma.userRole.deleteMany({ where: { userId: user.id } });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await this.prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { jobTitle: this.roleJobTitle(roleName) },
      create: { userId: user.id, jobTitle: this.roleJobTitle(roleName), language: "fr" }
    });
    return { success: true };
  }

  async disable(tenantId: string, userId: string, actorId: string) {
    if (userId === actorId) throw new BadRequestException("Vous ne pouvez pas désactiver votre propre compte.");
    const user = await this.userOrFail(tenantId, userId);
    this.assertNotPlatformUser(user);
    const activeOwners = await this.prisma.user.count({
      where: { tenantId, isActive: true, roles: { some: { role: { name: { in: ["Owner", "OWNER"] } } } } }
    });
    const targetIsOwner = await this.prisma.userRole.findFirst({ where: { userId, user: { tenantId }, role: { tenantId, name: { in: ["Owner", "OWNER"] } } } });
    if (targetIsOwner && activeOwners <= 1) throw new BadRequestException("Impossible de désactiver le dernier propriétaire actif.");
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await this.prisma.storeUser.updateMany({ where: { tenantId, userId }, data: { isActive: false } });
    return { success: true };
  }

  async reactivate(tenantId: string, userId: string) {
    const user = await this.userOrFail(tenantId, userId);
    this.assertNotPlatformUser(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    await this.prisma.storeUser.updateMany({ where: { tenantId, userId: user.id }, data: { isActive: true } });
    return { success: true };
  }

  async resetPassword(tenantId: string, userId: string, temporaryPassword?: string) {
    if (!temporaryPassword) throw new BadRequestException("Le nouveau mot de passe est obligatoire.");
    const user = await this.userOrFail(tenantId, userId);
    this.assertNotPlatformUser(user);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { password: await hashPassword(temporaryPassword) } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    });
    this.authService.invalidateUserSessions(user.id);
    return { success: true };
  }

  async roles(tenantId: string) {
    await this.ensureTenantRolePresets(tenantId);
    // "Administrator"/"Manager"/"Cashier"/"Inventory"/"Accountant" delibarement exclus : ce sont des
    // roles heritages crees sans aucune permission attachee (voir roles.service.ts) - les proposer ici
    // ferait choisir a un admin un role qui bloque completement l'utilisateur assigne. "Owner" reste
    // inclus car, contrairement aux autres, il recoit bien toutes les permissions et des utilisateurs
    // existants y sont deja reellement rattaches.
    return this.prisma.role.findMany({
      where: { tenantId, name: { in: [...tenantRoleNames, "Owner"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, isSystem: true }
    });
  }

  async ensureTenantRolePresets(tenantId: string) {
    const permissions = await Promise.all(defaultPermissions.map((permission) => this.prisma.permission.upsert({
      where: { key: permission.key },
      update: { name: permission.name, category: permission.category, description: permission.description },
      create: permission
    })));
    const permissionIdsByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

    for (const [roleName, preset] of Object.entries(tenantRolePresets) as Array<[TenantRoleName, (typeof tenantRolePresets)[TenantRoleName]]>) {
      const role = await this.prisma.role.upsert({
        where: { tenantId_name: { tenantId, name: roleName } },
        update: { description: preset.description, isSystem: true },
        create: { tenantId, name: roleName, description: preset.description, isSystem: true }
      });
      await this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await this.prisma.rolePermission.createMany({
        data: preset.permissions.map((key) => permissionIdsByKey.get(key)).filter(Boolean).map((permissionId) => ({ roleId: role.id, permissionId: permissionId! })),
        skipDuplicates: true
      });
    }
  }

  private async userOrFail(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException("Utilisateur introuvable");
    return user;
  }

  private assertNotPlatformUser(user: { roles?: Array<{ role?: { name?: string | null } | null }> }) {
    const roles = new Set((user.roles ?? []).map((entry) => entry.role?.name).filter(Boolean));
    if (roles.has("SUPER_ADMIN") || roles.has("PlatformAdmin")) {
      throw new BadRequestException("Action interdite sur un compte administrateur plateforme.");
    }
  }

  private async roleOrFail(tenantId: string, roleName: TenantRoleName) {
    await this.ensureTenantRolePresets(tenantId);
    const role = await this.prisma.role.findFirst({ where: { tenantId, name: roleName } });
    if (!role) throw new NotFoundException("Rôle introuvable");
    return role;
  }

  private roleJobTitle(roleName: string) {
    return roleName === "OWNER" || roleName === "Owner" ? "Propriétaire" : roleName;
  }
}

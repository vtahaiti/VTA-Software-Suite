import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
const roleInclude = { permissions: { include: { permission: true } } };
// Rôles par défaut historiques (Administrator, Manager, Cashier, Sales, Inventory, HR, Accountant,
// Technician, Viewer) crees sans aucune permission attachee - un utilisateur assigne a l'un d'eux se
// retrouvait sans aucun droit. Ils polluaient aussi l'affichage avec des doublons du vrai systeme de
// roles (tenant-role-presets.ts, utilise par la page Utilisateurs). "Owner" est exclu de ce filtre :
// contrairement aux autres, il recevait bien toutes les permissions et reste reellement assigne a des
// utilisateurs existants - le masquer casserait leur acces visible.
const BROKEN_LEGACY_ROLE_NAMES = ["Administrator", "Manager", "Cashier", "Sales", "Inventory", "HR", "Accountant", "Technician", "Viewer"];
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly usersService: UsersService) {}
  async findAll(tenantId: string) {
    await this.usersService.ensureTenantRolePresets(tenantId);
    return this.prisma.role.findMany({ where: { tenantId, name: { notIn: BROKEN_LEGACY_ROLE_NAMES } }, include: roleInclude, orderBy: { name: "asc" } });
  }
  async create(tenantId: string, dto: CreateRoleDto) {
    try { return await this.prisma.role.create({ data: { tenantId, name: dto.name, description: dto.description, permissions: this.permissionCreate(dto.permissionIds) }, include: roleInclude }); }
    catch (error) { if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Rôle déjà existant"); throw error; }
  }
  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    await this.findOneOrFail(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) await tx.rolePermission.deleteMany({ where: { roleId: id } });
      return tx.role.update({ where: { id }, data: { name: dto.name, description: dto.description, permissions: this.permissionCreate(dto.permissionIds) }, include: roleInclude });
    });
  }
  async remove(tenantId: string, id: string) {
    const role = await this.findOneOrFail(tenantId, id);
    if (role.isSystem) throw new ConflictException("Un rôle système ne peut pas être supprimé");
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }
  private async findOneOrFail(tenantId: string, id: string) { const role = await this.prisma.role.findFirst({ where: { id, tenantId } }); if (!role) throw new NotFoundException("Rôle introuvable"); return role; }
  private permissionCreate(permissionIds?: string[]) { return permissionIds?.length ? { create: permissionIds.map((permissionId) => ({ permissionId })) } : undefined; }
}


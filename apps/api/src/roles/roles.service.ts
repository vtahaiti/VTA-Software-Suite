import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { defaultRoles } from "../rbac/default-roles";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
const roleInclude = { permissions: { include: { permission: true } } };
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly permissionsService: PermissionsService) {}
  async findAll(tenantId: string) { await this.ensureDefaultRoles(tenantId); return this.prisma.role.findMany({ where: { tenantId }, include: roleInclude, orderBy: { name: "asc" } }); }
  async create(tenantId: string, dto: CreateRoleDto) {
    try { return await this.prisma.role.create({ data: { tenantId, name: dto.name, description: dto.description, permissions: this.permissionCreate(dto.permissionIds) }, include: roleInclude }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Role deja existant"); throw error; }
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
    if (role.isSystem) throw new ConflictException("Un role systeme ne peut pas etre supprime");
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }
  async ensureDefaultRoles(tenantId: string) {
    await this.ensureTenant(tenantId);
    await this.permissionsService.ensureDefaultPermissions();
    const permissions = await this.prisma.permission.findMany();
    await this.prisma.$transaction(defaultRoles.map((roleName) => this.prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: { isSystem: true },
      create: { tenantId, name: roleName, description: `Role par defaut ${roleName}`, isSystem: true, permissions: roleName === "Owner" ? this.permissionCreate(permissions.map((permission) => permission.id)) : undefined }
    })));
  }
  private async findOneOrFail(tenantId: string, id: string) { const role = await this.prisma.role.findFirst({ where: { id, tenantId } }); if (!role) throw new NotFoundException("Role introuvable"); return role; }
  private permissionCreate(permissionIds?: string[]) { return permissionIds?.length ? { create: permissionIds.map((permissionId) => ({ permissionId })) } : undefined; }
  private async ensureTenant(tenantId: string) {
    await this.prisma.tenant.upsert({ where: { id: tenantId }, update: {}, create: { id: tenantId, name: "VTA Commerce", slug: "vta-commerce", status: "ACTIVE", settings: { create: {} }, logo: { create: { alt: "VTA Commerce" } }, subscription: { create: { plan: "FREE", status: "TRIALING" } } } });
  }
}
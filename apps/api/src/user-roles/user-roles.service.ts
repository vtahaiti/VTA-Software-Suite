import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AssignUserRoleDto } from "./dto/assign-user-role.dto";
@Injectable()
export class UserRolesService {
  constructor(private readonly prisma: PrismaService) {}
  async assign(tenantId: string, dto: AssignUserRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
    if (!role) throw new NotFoundException("Role introuvable");
    return this.prisma.userRole.upsert({ where: { userId_roleId: { userId: dto.userId, roleId: dto.roleId } }, update: {}, create: { userId: dto.userId, roleId: dto.roleId } });
  }
}
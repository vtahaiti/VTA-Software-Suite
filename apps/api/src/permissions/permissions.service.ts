import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { defaultPermissions } from "../rbac/default-permissions";
import { CreatePermissionDto } from "./dto/create-permission.dto";
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll() { await this.ensureDefaultPermissions(); return this.prisma.permission.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] }); }
  async create(dto: CreatePermissionDto) {
    try { return await this.prisma.permission.create({ data: { key: dto.key.trim().toLowerCase(), name: dto.name, category: dto.category, description: dto.description } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Permission deja existante"); throw error; }
  }
  async ensureDefaultPermissions() {
    await this.prisma.$transaction(defaultPermissions.map((permission) => this.prisma.permission.upsert({ where: { key: permission.key }, update: { name: permission.name, category: permission.category, description: permission.description }, create: permission })));
  }
}
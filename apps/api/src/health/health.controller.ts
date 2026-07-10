import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return {
      status: "ok",
      service: "vta-commerce-api"
    };
  }

  @Get("database")
  async database() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "postgresql"
    };
  }

  @Get("ready")
  async ready() {
    const startedAt = Date.now() - Math.floor(process.uptime() * 1000);
    const [databaseCheck, migrationCount] = await Promise.all([
      this.prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint as count FROM "_prisma_migrations"`
    ]);

    return {
      status: databaseCheck[0]?.ok === 1 ? "ok" : "error",
      service: "vta-commerce-api",
      database: "postgresql",
      migrations: Number(migrationCount[0]?.count ?? 0),
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: new Date(startedAt).toISOString()
    };
  }
}

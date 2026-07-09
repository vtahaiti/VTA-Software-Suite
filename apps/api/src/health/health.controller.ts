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
}
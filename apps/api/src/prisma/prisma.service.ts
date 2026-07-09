import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const defaultDatabaseUrl = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = defaultDatabaseUrl;
    }

    super();
  }

  async onModuleInit() {
    // Prisma connects lazily on the first query so the API can boot before PostgreSQL is ready.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
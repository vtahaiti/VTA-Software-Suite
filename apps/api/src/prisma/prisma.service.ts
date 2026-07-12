import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { getCurrentRequestProfile } from "../performance/request-profiler";

const defaultDatabaseUrl = "postgresql://vta:vta_password@localhost:5432/vta_commerce?schema=public";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = defaultDatabaseUrl;
    }

    const queryLoggingEnabled = (process.env.PERF_QUERY_LOG ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1";
    const options: Prisma.PrismaClientOptions = queryLoggingEnabled
      ? { log: [{ emit: "event", level: "query" }] }
      : {};

    super(options);

    if (queryLoggingEnabled) {
      (this as unknown as { $on: (event: "query", callback: (query: { duration: number; target?: string }) => void) => void }).$on("query", (query) => {
        const profile = getCurrentRequestProfile();
        if (profile) {
          profile.sqlCount += 1;
          profile.sqlMs += query.duration;
          return;
        }

        this.logger.log(JSON.stringify({
          event: "prisma_query",
          durationMs: query.duration,
          target: query.target ?? "unknown"
        }));
      });
    }
  }

  async onModuleInit() {
    const startedAt = Date.now();
    await this.connectWithRetry();
    if ((process.env.PERF_BOOT_LOG ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1") {
      this.logger.log(JSON.stringify({
        event: "prisma_bootstrap",
        phase: "connected",
        durationMs: Date.now() - startedAt,
        retries: Number(process.env.PRISMA_CONNECT_RETRIES ?? 5)
      }));
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry() {
    const retries = Number(process.env.PRISMA_CONNECT_RETRIES ?? 5);
    const delayMs = Number(process.env.PRISMA_CONNECT_RETRY_DELAY_MS ?? 1000);
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(JSON.stringify({ event: "prisma_bootstrap", phase: "connect_retry", attempt, retries }));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    this.logger.error(JSON.stringify({ event: "prisma_bootstrap", phase: "connect_failed", retries }));
    throw lastError;
  }
}

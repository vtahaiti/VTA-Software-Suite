import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import { join } from "path";
import { AppModule } from "./app.module";
import { requestProfilerMiddleware } from "./performance/request-profiler";

function buildCorsOrigins() {
  const configuredOrigins = [
    process.env.WEB_URL,
    process.env.ADMIN_WEB_URL,
    process.env.CORS_ORIGINS
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return Array.from(
    new Set([
      ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
      "https://vtaerp.com",
      "https://www.vtaerp.com",
      "https://admin.vtaerp.com",
      ...configuredOrigins
    ])
  );
}

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  for (const [name, value] of [["JWT_SECRET", process.env.JWT_SECRET], ["JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET]] as const) {
    if (!value || value.length < 32 || value === "change-me" || value === "change-me-refresh") {
      throw new Error(`${name} doit contenir au moins 32 caractères en production.`);
    }
  }
}

async function bootstrap() {
  assertProductionSecrets();
  const bootstrapStartedAt = Date.now();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  if ((process.env.PERF_BOOT_LOG ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1") {
    console.log(JSON.stringify({ event: "api_bootstrap", phase: "nest_created", durationMs: Date.now() - bootstrapStartedAt, uptimeSeconds: Math.round(process.uptime()) }));
  }

  app.use(cookieParser());
  app.use(requestProfilerMiddleware);
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.enableCors({
    origin: buildCorsOrigins(),
    credentials: true
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  if ((process.env.PERF_BOOT_LOG ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1") {
    console.log(JSON.stringify({ event: "api_bootstrap", phase: "listening", durationMs: Date.now() - bootstrapStartedAt, port, uptimeSeconds: Math.round(process.uptime()) }));
  }
}

bootstrap();

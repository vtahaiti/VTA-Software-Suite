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
      "http://localhost:3000",
      "https://vtaerp.com",
      "https://www.vtaerp.com",
      "https://admin.vtaerp.com",
      ...configuredOrigins
    ])
  );
}

async function bootstrap() {
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

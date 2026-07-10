import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import { join } from "path";
import { AppModule } from "./app.module";

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
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
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
}

bootstrap();

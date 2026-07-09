import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express from "express";
import { join } from "path";
import { AppModule } from "./app.module";

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
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
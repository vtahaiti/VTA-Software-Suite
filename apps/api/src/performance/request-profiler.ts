import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

export type RequestProfile = {
  requestId: string;
  method: string;
  path: string;
  startedAt: bigint;
  sqlCount: number;
  sqlMs: number;
};

const allowedQueryKeys = new Set(["page", "limit", "status", "excludeTestData", "width"]);

export const requestProfileStorage = new AsyncLocalStorage<RequestProfile>();

export function getCurrentRequestProfile() {
  return requestProfileStorage.getStore();
}

export function requestProfilerMiddleware(request: Request, response: Response, next: NextFunction) {
  if ((process.env.PERF_REQUEST_LOG ?? (process.env.NODE_ENV === "production" ? "1" : "0")) !== "1") {
    next();
    return;
  }

  const profile: RequestProfile = {
    requestId: request.header("x-request-id") || randomUUID(),
    method: request.method,
    path: sanitizePath(request.originalUrl || request.url),
    startedAt: process.hrtime.bigint(),
    sqlCount: 0,
    sqlMs: 0
  };

  response.setHeader("X-Request-Id", profile.requestId);

  requestProfileStorage.run(profile, () => {
    response.on("finish", () => {
      const totalMs = Number(process.hrtime.bigint() - profile.startedAt) / 1_000_000;
      console.log(JSON.stringify({
        event: "request_profile",
        requestId: profile.requestId,
        method: profile.method,
        path: profile.path,
        statusCode: response.statusCode,
        totalMs: Math.round(totalMs * 100) / 100,
        sqlCount: profile.sqlCount,
        sqlMs: Math.round(profile.sqlMs * 100) / 100,
        nonSqlMs: Math.round(Math.max(0, totalMs - profile.sqlMs) * 100) / 100,
        uptimeSeconds: Math.round(process.uptime())
      }));
    });

    next();
  });
}

function sanitizePath(value: string) {
  try {
    const url = new URL(value, "http://local");
    const search = new URLSearchParams();
    for (const [key, queryValue] of url.searchParams.entries()) {
      search.set(key, allowedQueryKeys.has(key) ? queryValue : "[redacted]");
    }
    const query = search.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return value.split("?")[0] || "/";
  }
}

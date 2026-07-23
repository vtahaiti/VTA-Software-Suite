import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { AuthUser } from "../auth/types/auth-user";

const ignoredPrefixes = ["/audit", "/audit-logs", "/health", "/notifications"];
const sensitiveKeys = ["password", "confirmPassword", "token", "accessToken", "refreshToken", "authorization", "cookie"];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditLogs: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const action = this.resolveAction(request.method, request.path ?? request.url);

    if (!request.user || !action || this.shouldIgnore(request.path ?? request.url)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const body = sanitize(request.body) as Prisma.InputJsonValue;

    return next.handle().pipe(
      tap((result) => {
        const safeResult = sanitize(result) as Prisma.InputJsonValue;
        void this.auditLogs.create({
          tenantId: request.user?.tenantId,
          tenantName: request.user?.tenant,
          userId: request.user?.id,
          userEmail: request.user?.email,
          userName: request.user?.name,
          storeId: pickString(request.body?.storeId ?? request.query?.storeId),
          warehouseId: pickString(request.body?.warehouseId ?? request.query?.warehouseId),
          action,
          entity: this.resolveEntity(request.path ?? request.url),
          entityId: pickString(request.params?.id ?? (result as { id?: string } | undefined)?.id),
          message: this.description(action),
          oldValue: undefined,
          newValue: request.method === "DELETE" ? body : safeResult ?? body,
          metadata: { method: request.method, path: request.path ?? request.url, durationMs: Date.now() - startedAt },
          ipAddress: clientIp(request),
          userAgent: request.headers["user-agent"],
          browser: parseBrowser(request.headers["user-agent"]),
          operatingSystem: parseOperatingSystem(request.headers["user-agent"])
        }).catch((error) => {
          this.logger.error(`Echec d'ecriture du journal d'audit (action=${action}, path=${request.path ?? request.url})`, error instanceof Error ? error.stack : String(error));
        });
      })
    );
  }

  private shouldIgnore(path: string) {
    return ignoredPrefixes.some((prefix) => path.startsWith(prefix));
  }

  private resolveAction(method: string, path: string): AuditAction | null {
    const normalized = path.toLowerCase();
    if (method === "GET" && /(print|receipt|pdf)/.test(normalized) && normalized.includes("invoice")) return AuditAction.PRINT_INVOICE;
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
    const verb = method === "POST" ? "CREATE" : method === "DELETE" ? "DELETE" : "UPDATE";
    if (normalized.includes("products/categories")) return audit(`${verb}_CATEGORY`);
    if (normalized.includes("products")) return audit(`${verb}_PRODUCT`);
    if (normalized.includes("customers")) return audit(`${verb}_CUSTOMER`);
    if (normalized.includes("suppliers")) return audit(`${verb}_SUPPLIER`);
    if (normalized.includes("stock") || normalized.includes("inventory")) return audit(`${verb}_STOCK`);
    if (normalized.includes("transfers")) return audit(`${verb}_TRANSFER`);
    if (normalized.includes("purchases")) return audit(`${verb}_PURCHASE`);
    if (normalized.includes("receipts")) return audit(`${verb}_RECEIPT`);
    if (normalized.includes("quotes")) return audit(`${verb}_QUOTE`);
    if (normalized.includes("invoices")) return audit(`${verb}_INVOICE`);
    if (normalized.includes("payments")) return audit(`${verb}_PAYMENT`);
    if (normalized.includes("users") || normalized.includes("profile")) return audit(`${verb}_USER`);
    if (normalized.includes("stores")) return audit(`${verb}_STORE`);
    if (normalized.includes("warehouses")) return audit(`${verb}_WAREHOUSE`);
    if (normalized.includes("cash-register")) return audit(`${verb}_CASH_REGISTER`);
    if (normalized.includes("settings")) return AuditAction.UPDATE_SETTINGS;
    if (normalized.includes("pos") || normalized.includes("sales")) return method === "DELETE" ? AuditAction.DELETE_POS_SALE : AuditAction.CREATE_POS_SALE;
    return audit(verb);
  }

  private resolveEntity(path: string) {
    const firstSegment = path.split("?")[0].split("/").filter(Boolean)[0] ?? "System";
    return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
  }

  private description(action: AuditAction) {
    return `Action ${action} enregistree automatiquement`;
  }
}

function audit(value: string): AuditAction {
  return (AuditAction as Record<string, AuditAction>)[value] ?? AuditAction.UPDATE;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function clientIp(request: Request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return request.ip ?? request.socket.remoteAddress;
}

function parseBrowser(userAgent?: string) {
  if (!userAgent) return undefined;
  if (userAgent.includes("Edg/")) return "Microsoft Edge";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Safari";
  return "Autre";
}

function parseOperatingSystem(userAgent?: string) {
  if (!userAgent) return undefined;
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Mac OS")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  return "Autre";
}

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry));
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase())) ? "[masque]" : sanitize(entry)
    ])
  );
}

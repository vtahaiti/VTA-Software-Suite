import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationStatus, NotificationType, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";

type NotificationQuery = { status?: "unread" | "read" | "archived"; type?: "info" | "success" | "warning" | "error"; module?: string; page?: string; limit?: string };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  createForUser(tenantId: string, currentUserId: string, dto: CreateNotificationDto) {
    return this.createSystem({
      tenantId,
      userId: dto.userId ?? currentUserId,
      role: dto.role,
      title: dto.title,
      message: dto.message,
      type: dto.type ?? "info",
      module: dto.module,
      referenceId: dto.referenceId,
      link: dto.link,
      dedupKey: dto.dedupKey,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined
    });
  }

  async findForUser(user: AuthUser, query: NotificationQuery) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const where: Prisma.NotificationWhereInput = {
      tenantId: user.tenantId,
      OR: [{ userId: user.id }, { role: { in: this.userRoleKeys(user) } }],
      status: query.status ? this.toStatus(query.status) : { not: NotificationStatus.ARCHIVED },
      type: query.type ? this.toType(query.type) : undefined,
      module: query.module ? { equals: query.module, mode: "insensitive" } : undefined
    };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { tenantId: user.tenantId, OR: [{ userId: user.id }, { role: { in: this.userRoleKeys(user) } }], status: NotificationStatus.UNREAD } })
    ]);
    return { items, total, unread, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) };
  }

  async unreadCount(user: AuthUser) {
    const count = await this.prisma.notification.count({ where: { tenantId: user.tenantId, OR: [{ userId: user.id }, { role: { in: this.userRoleKeys(user) } }], status: NotificationStatus.UNREAD } });
    return { count };
  }

  async markAsRead(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.READ, readAt: new Date() } });
  }

  async markAllAsRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({ where: { tenantId: user.tenantId, OR: [{ userId: user.id }, { role: { in: this.userRoleKeys(user) } }], status: NotificationStatus.UNREAD }, data: { status: NotificationStatus.READ, readAt: new Date() } });
    return { updated: result.count };
  }

  async archive(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.ARCHIVED } });
  }

  notifyLowStock(tenantId: string, userId: string, productName: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Stock faible", message: `${productName} est sous le seuil minimum.`, type: "warning", module: "inventory", referenceId, link: referenceId ? `/dashboard/products/${referenceId}` : "/dashboard/inventory", dedupKey: `stock-low:${referenceId ?? productName}` });
  }

  notifyOutOfStock(tenantId: string, userId: string, productName: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Rupture de stock", message: `${productName} est en rupture de stock.`, type: "error", module: "inventory", referenceId, link: referenceId ? `/dashboard/products/${referenceId}` : "/dashboard/inventory", dedupKey: `stock-out:${referenceId ?? productName}` });
  }

  notifySaleCreated(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Vente créée", message: "Une nouvelle vente a été enregistrée.", type: "success", module: "sales", referenceId, link: referenceId ? `/dashboard/sales/completed/${referenceId}` : "/dashboard/sales/completed" });
  }

  notifyUnpaidInvoice(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Facture impayée", message: "Une facture reste impayée ou partiellement payée.", type: "warning", module: "invoices", referenceId, dedupKey: `invoice-unpaid:${referenceId ?? "unknown"}` });
  }

  notifyPaymentReceived(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Paiement reçu", message: "Un paiement a été enregistré.", type: "success", module: "payments", referenceId });
  }

  notifyBackupCompleted(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Sauvegarde réussie", message: "La sauvegarde a été préparée avec succès.", type: "success", module: "backups", referenceId, dedupKey: referenceId ? `backup:${referenceId}` : undefined });
  }

  notifyBackupFailed(tenantId: string, userId: string, message: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Sauvegarde échouée", message, type: "error", module: "backups", referenceId, dedupKey: referenceId ? `backup-failed:${referenceId}` : undefined });
  }

  notifyFailedLogin(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title: "Tentative de connexion échouée", message: "Une tentative de connexion échouée a été détectée.", type: "error", module: "security", referenceId });
  }

  notifyImportResult(tenantId: string, userId: string, status: "success" | "warning" | "error", title: string, message: string, referenceId?: string) {
    return this.createSystem({ tenantId, userId, title, message, type: status, module: "import-export", referenceId, link: "/dashboard/import-export", dedupKey: referenceId ? `import:${referenceId}` : undefined });
  }

  notifySubscriptionExpiring(tenantId: string, userId: string, days: number) {
    return this.createSystem({ tenantId, userId, title: "Abonnement bientôt expiré", message: `Votre abonnement expire dans ${days} jour${days > 1 ? "s" : ""}.`, type: "warning", module: "subscriptions", link: "/dashboard/settings/subscription", dedupKey: `subscription-expiring:${days}` });
  }

  private async createSystem(input: { tenantId: string; userId: string; title: string; message: string; type: "info" | "success" | "warning" | "error"; module?: string; referenceId?: string; role?: string; link?: string; dedupKey?: string; metadata?: Prisma.InputJsonValue }) {
    if (input.link && !this.isSafeLink(input.link)) throw new BadRequestException("Lien de notification invalide");
    const data = {
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      title: input.title,
      message: input.message,
      type: this.toType(input.type),
      module: input.module,
      referenceId: input.referenceId,
      link: input.link,
      dedupKey: input.dedupKey,
      metadata: input.metadata
    };
    if (input.dedupKey) {
      return this.prisma.notification.upsert({
        where: { tenantId_userId_dedupKey: { tenantId: input.tenantId, userId: input.userId, dedupKey: input.dedupKey } },
        create: data,
        update: { ...data, status: NotificationStatus.UNREAD, readAt: null }
      });
    }
    return this.prisma.notification.create({ data });
  }

  private async ensureOwned(user: AuthUser, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, tenantId: user.tenantId, OR: [{ userId: user.id }, { role: { in: this.userRoleKeys(user) } }] } });
    if (!notification) throw new NotFoundException("Notification introuvable");
    return notification;
  }

  private userRoleKeys(user: AuthUser) {
    return [user.role, user.role?.toUpperCase(), user.role?.toLowerCase()].filter(Boolean) as string[];
  }

  private isSafeLink(link: string) {
    return link.startsWith("/dashboard") && !link.startsWith("//") && !link.includes("://");
  }

  private toType(type?: string) {
    const value = (type ?? "info").toUpperCase();
    return Object.values(NotificationType).includes(value as NotificationType) ? value as NotificationType : NotificationType.INFO;
  }

  private toStatus(status?: string) {
    const value = (status ?? "unread").toUpperCase();
    return Object.values(NotificationStatus).includes(value as NotificationStatus) ? value as NotificationStatus : NotificationStatus.UNREAD;
  }
}


import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationStatus, NotificationType, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";

type NotificationQuery = { status?: "unread" | "read" | "archived"; type?: "info" | "success" | "warning" | "error"; module?: string };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  createForUser(tenantId: string, currentUserId: string, dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: dto.userId ?? currentUserId,
        title: dto.title,
        message: dto.message,
        type: this.toType(dto.type),
        module: dto.module,
        referenceId: dto.referenceId
      }
    });
  }

  findForUser(user: AuthUser, query: NotificationQuery) {
    const where: Prisma.NotificationWhereInput = {
      tenantId: user.tenantId,
      userId: user.id,
      status: query.status ? this.toStatus(query.status) : { not: NotificationStatus.ARCHIVED },
      type: query.type ? this.toType(query.type) : undefined,
      module: query.module ? { equals: query.module, mode: "insensitive" } : undefined
    };
    return this.prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async unreadCount(user: AuthUser) {
    const count = await this.prisma.notification.count({ where: { tenantId: user.tenantId, userId: user.id, status: NotificationStatus.UNREAD } });
    return { count };
  }

  async markAsRead(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.READ, readAt: new Date() } });
  }

  async markAllAsRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({ where: { tenantId: user.tenantId, userId: user.id, status: NotificationStatus.UNREAD }, data: { status: NotificationStatus.READ, readAt: new Date() } });
    return { updated: result.count };
  }

  async archive(user: AuthUser, id: string) {
    await this.ensureOwned(user, id);
    return this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.ARCHIVED } });
  }

  notifyLowStock(tenantId: string, userId: string, productName: string, referenceId?: string) {
    return this.createSystem(tenantId, userId, "Stock faible", `${productName} est sous le seuil minimum.`, "warning", "inventory", referenceId);
  }

  notifySaleCreated(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem(tenantId, userId, "Vente creee", "Une nouvelle vente a ete enregistree.", "success", "sales", referenceId);
  }

  notifyUnpaidInvoice(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem(tenantId, userId, "Facture impayee", "Une facture reste impayee ou partiellement payee.", "warning", "invoices", referenceId);
  }

  notifyPaymentReceived(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem(tenantId, userId, "Paiement recu", "Un paiement a ete enregistre.", "success", "payments", referenceId);
  }

  notifyBackupCompleted(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem(tenantId, userId, "Sauvegarde terminee", "La sauvegarde a ete preparee avec succes.", "success", "backups", referenceId);
  }

  notifyFailedLogin(tenantId: string, userId: string, referenceId?: string) {
    return this.createSystem(tenantId, userId, "Tentative de connexion echouee", "Une tentative de connexion echouee a ete detectee.", "error", "security", referenceId);
  }

  private createSystem(tenantId: string, userId: string, title: string, message: string, type: "info" | "success" | "warning" | "error", module: string, referenceId?: string) {
    return this.prisma.notification.create({ data: { tenantId, userId, title, message, type: this.toType(type), module, referenceId } });
  }

  private async ensureOwned(user: AuthUser, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, tenantId: user.tenantId, userId: user.id } });
    if (!notification) throw new NotFoundException("Notification introuvable");
    return notification;
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
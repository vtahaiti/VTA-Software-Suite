import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AssetReservationStatusValue, AssetReservationTypeValue, CreateAssetReservationDto, ReturnAssetReservationDto } from "./dto/asset-reservation.dto";

@Injectable()
export class AssetReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, assetType: AssetReservationTypeValue, status?: AssetReservationStatusValue) {
    return this.prisma.assetReservation.findMany({
      where: { tenantId, assetType, status },
      include: { product: true, customer: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenantId: string, dto: CreateAssetReservationDto, userId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId } });
    if (!product) throw new NotFoundException("Actif introuvable");
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new NotFoundException("Client introuvable");

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const expectedEndDate = new Date(dto.expectedEndDate);
    if (expectedEndDate <= startDate) throw new BadRequestException("La date de retour prevue doit etre apres la date de depart.");

    try {
      return await this.prisma.assetReservation.create({
        data: {
          tenantId,
          productId: dto.productId,
          customerId: dto.customerId,
          assetType: dto.assetType,
          startDate,
          expectedEndDate,
          rate: dto.rate ?? 0,
          deposit: dto.deposit ?? 0,
          note: dto.note,
          userId
        },
        include: { product: true, customer: true }
      });
    } catch (error) {
      // L'index unique partiel (status = 'ACTIVE') cree en migration bloque le double-booking au niveau
      // base de donnees : 2 reservations concurrentes sur le meme actif font echouer la 2e avec P2002,
      // qu'on traduit ici en message clair plutot que de laisser fuiter l'erreur SQL brute.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Cet actif est deja reserve actuellement.");
      }
      throw error;
    }
  }

  async returnAsset(tenantId: string, id: string, dto: ReturnAssetReservationDto) {
    const reservation = await this.prisma.assetReservation.findFirst({ where: { id, tenantId } });
    if (!reservation) throw new NotFoundException("Reservation introuvable");
    if (reservation.status !== "ACTIVE") throw new BadRequestException("Cette reservation n'est plus active.");
    return this.prisma.assetReservation.update({
      where: { id },
      data: { status: "RETURNED", actualEndDate: new Date(), note: dto.note ?? reservation.note },
      include: { product: true, customer: true }
    });
  }

  async cancel(tenantId: string, id: string) {
    const reservation = await this.prisma.assetReservation.findFirst({ where: { id, tenantId } });
    if (!reservation) throw new NotFoundException("Reservation introuvable");
    if (reservation.status !== "ACTIVE") throw new BadRequestException("Cette reservation n'est plus active.");
    return this.prisma.assetReservation.update({ where: { id }, data: { status: "CANCELLED", actualEndDate: new Date() } });
  }
}

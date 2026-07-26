import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { createRestaurantStarterCatalog } from "../onboarding/restaurant-starter-catalog";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RestaurantStarterService implements OnModuleInit {
  private readonly logger = new Logger(RestaurantStarterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { not: "DELETED" } },
      select: { id: true, businessProfileType: true, primaryActivity: true }
    });
    const restaurants = tenants.filter((tenant) => isRestaurantProfile(tenant.businessProfileType, tenant.primaryActivity));
    let installed = 0;
    for (const tenant of restaurants) {
      try {
        const result = await this.install(tenant.id);
        if (Object.values(result.created).some((count) => count > 0)) installed += 1;
      } catch (error) {
        this.logger.error(`Installation des modèles Restaurant impossible pour le tenant ${tenant.id}`, error instanceof Error ? error.stack : undefined);
      }
    }
    if (restaurants.length) this.logger.log(`Base Restaurant vérifiée pour ${restaurants.length} tenant(s), complétée pour ${installed}.`);
  }

  async install(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessProfileType: true, primaryActivity: true }
    });
    if (!tenant) throw new NotFoundException("Entreprise introuvable.");
    if (!isRestaurantProfile(tenant.businessProfileType, tenant.primaryActivity)) {
      throw new BadRequestException("Les modèles Restaurant sont réservés aux profils Restaurant, Bar et Fast-food.");
    }
    const store = await this.prisma.store.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    if (!store) throw new BadRequestException("Créez d'abord un magasin principal.");

    const result = await this.prisma.$transaction((tx) => createRestaurantStarterCatalog(tx, tenantId, store.id));
    return {
      success: true,
      created: result.created,
      message: Object.values(result.created).some((count) => count > 0)
        ? "Base Restaurant installée. Les éléments existants ont été conservés."
        : "La base Restaurant est déjà installée."
    };
  }
}

function isRestaurantProfile(profile?: string | null, activity?: string | null) {
  const normalizedProfile = String(profile ?? "").toLowerCase();
  const normalizedActivity = String(activity ?? "").toLowerCase();
  return normalizedProfile === "restaurant" || normalizedActivity.includes("restaurant") || normalizedActivity === "bar" || normalizedActivity.includes("fast-food");
}

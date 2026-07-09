import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

const tenantIncludes = {
  settings: true,
  logo: true,
  subscription: true
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenant.findMany({
      include: tenantIncludes,
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: tenantIncludes
    });

    if (!tenant) {
      throw new NotFoundException("Tenant introuvable");
    }

    return tenant;
  }

  async create(createTenantDto: CreateTenantDto) {
    try {
      const currency = createTenantDto.currency ?? "HTG";
      const timezone = createTenantDto.timezone ?? "America/Port-au-Prince";
      const language = createTenantDto.language ?? "fr";

      return await this.prisma.tenant.create({
        data: {
          name: createTenantDto.name,
          slug: this.normalizeSlug(createTenantDto.slug),
          address: createTenantDto.address,
          phone: createTenantDto.phone,
          email: createTenantDto.email,
          currency,
          timezone,
          language,
          status: createTenantDto.status ?? "TRIAL",
          settings: {
            create: { currency, timezone, language }
          },
          logo: {
            create: {
              url: createTenantDto.logoUrl,
              alt: createTenantDto.logoAlt ?? createTenantDto.name
            }
          },
          subscription: {
            create: {
              plan: createTenantDto.subscriptionPlan ?? "FREE",
              status: "TRIALING"
            }
          }
        },
        include: tenantIncludes
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Ce tenant existe deja");
      }

      throw error;
    }
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    await this.findOne(id);

    try {
      const tenantData: Prisma.TenantUpdateInput = {
        name: updateTenantDto.name,
        slug: updateTenantDto.slug ? this.normalizeSlug(updateTenantDto.slug) : undefined,
        address: updateTenantDto.address,
        phone: updateTenantDto.phone,
        email: updateTenantDto.email,
        currency: updateTenantDto.currency,
        timezone: updateTenantDto.timezone,
        language: updateTenantDto.language,
        status: updateTenantDto.status
      };

      return await this.prisma.tenant.update({
        where: { id },
        data: {
          ...tenantData,
          settings: this.buildSettingsUpdate(updateTenantDto),
          logo: this.buildLogoUpdate(updateTenantDto),
          subscription: this.buildSubscriptionUpdate(updateTenantDto)
        },
        include: tenantIncludes
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Ce tenant existe deja");
      }

      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.tenant.delete({ where: { id } });
    return { success: true };
  }

  private buildSettingsUpdate(updateTenantDto: UpdateTenantDto): Prisma.TenantSettingsUpdateOneWithoutTenantNestedInput | undefined {
    if (!updateTenantDto.currency && !updateTenantDto.timezone && !updateTenantDto.language) {
      return undefined;
    }

    return {
      upsert: {
        create: {
          currency: updateTenantDto.currency ?? "HTG",
          timezone: updateTenantDto.timezone ?? "America/Port-au-Prince",
          language: updateTenantDto.language ?? "fr"
        },
        update: {
          currency: updateTenantDto.currency,
          timezone: updateTenantDto.timezone,
          language: updateTenantDto.language
        }
      }
    };
  }

  private buildLogoUpdate(updateTenantDto: UpdateTenantDto): Prisma.TenantLogoUpdateOneWithoutTenantNestedInput | undefined {
    if (!updateTenantDto.logoUrl && !updateTenantDto.logoAlt) {
      return undefined;
    }

    return {
      upsert: {
        create: {
          url: updateTenantDto.logoUrl,
          alt: updateTenantDto.logoAlt ?? updateTenantDto.name
        },
        update: {
          url: updateTenantDto.logoUrl,
          alt: updateTenantDto.logoAlt
        }
      }
    };
  }

  private buildSubscriptionUpdate(updateTenantDto: UpdateTenantDto): Prisma.TenantSubscriptionUpdateOneWithoutTenantNestedInput | undefined {
    if (!updateTenantDto.subscriptionPlan) {
      return undefined;
    }

    return {
      upsert: {
        create: {
          plan: updateTenantDto.subscriptionPlan,
          status: "TRIALING"
        },
        update: {
          plan: updateTenantDto.subscriptionPlan
        }
      }
    };
  }

  private normalizeSlug(slug: string) {
    return slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
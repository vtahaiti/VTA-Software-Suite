import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCompanyProfileDto } from "./dto/settings.dto";

@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async find(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { companyProfile: true, logo: true } });
    const companyName = tenant.companyProfile?.companyName ?? tenant.companyProfile?.name ?? tenant.name ?? "Mon entreprise";
    return {
      name: companyName,
      companyName,
      primaryColor: tenant.companyProfile?.primaryColor ?? "#2563eb",
      logoUrl: tenant.companyProfile?.logoUrl ?? tenant.logo?.url ?? "",
      phone: tenant.companyProfile?.phone ?? tenant.phone ?? "",
      whatsapp: tenant.companyProfile?.whatsapp ?? "",
      email: tenant.companyProfile?.email ?? tenant.email ?? "",
      address: tenant.companyProfile?.address ?? tenant.address ?? "",
      city: tenant.companyProfile?.city ?? "",
      country: tenant.companyProfile?.country ?? "",
      taxNumber: tenant.companyProfile?.taxNumber ?? "",
      currency: tenant.companyProfile?.currency ?? tenant.currency,
      language: tenant.companyProfile?.language ?? tenant.language,
      timezone: tenant.companyProfile?.timezone ?? tenant.timezone,
      uploadPrepared: true
    };
  }

  async update(tenantId: string, dto: UpdateCompanyProfileDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { companyProfile: true } });
      const displayName = dto.companyName ?? dto.name ?? current.companyProfile?.companyName ?? current.companyProfile?.name ?? current.name;
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: displayName,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          currency: dto.currency,
          language: dto.language,
          timezone: dto.timezone
        }
      });
      if (dto.logoUrl !== undefined) {
        await tx.tenantLogo.upsert({ where: { tenantId }, update: { url: dto.logoUrl, alt: displayName }, create: { tenantId, url: dto.logoUrl, alt: displayName } });
      }
      await tx.companyProfile.upsert({
        where: { tenantId },
        update: { ...dto, name: displayName, companyName: displayName },
        create: {
          tenantId,
          name: displayName,
          companyName: displayName,
          primaryColor: dto.primaryColor,
          logoUrl: dto.logoUrl,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          email: dto.email,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          taxNumber: dto.taxNumber,
          currency: dto.currency ?? "HTG",
          language: dto.language ?? "fr",
          timezone: dto.timezone ?? "America/Port-au-Prince"
        }
      });
      return this.find(tenantId);
    });
  }
}

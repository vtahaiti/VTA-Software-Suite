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
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { companyProfile: true } });
      const displayName = dto.companyName ?? dto.name ?? current.companyProfile?.companyName ?? current.companyProfile?.name ?? current.name;
      const keep = <T>(value: T | undefined, fallback: T | null) => (value === undefined ? fallback : value);
      const normalized = {
        ...dto,
        name: displayName,
        companyName: displayName,
        phone: keep(dto.phone, current.companyProfile?.phone ?? current.phone ?? null),
        whatsapp: keep(dto.whatsapp, current.companyProfile?.whatsapp ?? null),
        email: keep(dto.email, current.companyProfile?.email ?? current.email ?? null),
        address: keep(dto.address, current.companyProfile?.address ?? current.address ?? null),
        city: keep(dto.city, current.companyProfile?.city ?? null),
        country: keep(dto.country, current.companyProfile?.country ?? null),
        taxNumber: keep(dto.taxNumber, current.companyProfile?.taxNumber ?? null),
        logoUrl: keep(dto.logoUrl, current.companyProfile?.logoUrl ?? null),
        primaryColor: keep(dto.primaryColor, current.companyProfile?.primaryColor ?? "#2563eb"),
        currency: dto.currency ?? current.companyProfile?.currency ?? current.currency ?? "HTG",
        language: dto.language ?? current.companyProfile?.language ?? current.language ?? "fr",
        timezone: dto.timezone ?? current.companyProfile?.timezone ?? current.timezone ?? "America/Port-au-Prince"
      };
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: displayName,
          phone: normalized.phone,
          email: normalized.email,
          address: normalized.address,
          currency: normalized.currency,
          language: normalized.language,
          timezone: normalized.timezone
        }
      });
      if (dto.logoUrl !== undefined) {
        await tx.tenantLogo.upsert({ where: { tenantId }, update: { url: normalized.logoUrl ?? "", alt: displayName }, create: { tenantId, url: normalized.logoUrl ?? "", alt: displayName } });
      }
      await tx.companyProfile.upsert({
        where: { tenantId },
        update: normalized,
        create: {
          tenantId,
          name: displayName,
          companyName: displayName,
          primaryColor: normalized.primaryColor,
          logoUrl: normalized.logoUrl,
          phone: normalized.phone,
          whatsapp: normalized.whatsapp,
          email: normalized.email,
          address: normalized.address,
          city: normalized.city,
          country: normalized.country,
          taxNumber: normalized.taxNumber,
          currency: normalized.currency,
          language: normalized.language,
          timezone: normalized.timezone
        }
      });
    });
    return this.find(tenantId);
  }
}

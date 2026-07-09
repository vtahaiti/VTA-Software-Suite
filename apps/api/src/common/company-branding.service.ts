import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CompanyBrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async forTenant(tenantId: string, userId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, include: { companyProfile: true } });
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    const profile = tenant?.companyProfile;
    return {
      logoUrl: profile?.logoUrl ?? null,
      companyName: profile?.companyName ?? profile?.name ?? tenant?.name ?? "VTA ERP",
      address: profile?.address ?? tenant?.address ?? null,
      phone: profile?.phone ?? tenant?.phone ?? null,
      whatsapp: profile?.whatsapp ?? null,
      email: profile?.email ?? tenant?.email ?? null,
      website: profile?.website ?? null,
      taxNumber: profile?.taxNumber ?? null,
      userName: user?.name ?? null,
      cashierName: user?.name ?? null,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5)
    };
  }
}
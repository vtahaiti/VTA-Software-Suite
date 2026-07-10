import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { defaultPermissions } from "../rbac/default-permissions";
import { businessModules, businessProfiles, findActivityTemplate, resolveBusinessProfileSlug } from "../business-profiles/business-catalog";
import { AuthService } from "../auth/auth.service";
import { isPasswordStrong, passwordPolicyMessage } from "../auth/password-policy";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { RegisterUserDto } from "./dto/register-user.dto";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly uploads: UploadsService
  ) {}

  async register(dto: RegisterUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (dto.password !== dto.confirmPassword) throw new BadRequestException("Les mots de passe ne correspondent pas.");
    if (!isPasswordStrong(dto.password)) throw new BadRequestException(passwordPolicyMessage);
    if (!dto.acceptedTerms) throw new BadRequestException("Vous devez accepter les conditions d’utilisation et la politique de confidentialité.");

    const existingUser = await this.prisma.user.findFirst({ where: { email } });
    if (existingUser) throw new BadRequestException("Un compte existe déjà avec cet email.");

    const existingPending = await this.prisma.pendingRegistration.findUnique({ where: { email } });
    if (existingPending && existingPending.expiresAt.getTime() > Date.now()) {
      throw new BadRequestException("Un compte est déjà en cours de création avec cet email.");
    }

    const token = randomUUID();
    await this.prisma.pendingRegistration.upsert({
      where: { email },
      update: {
        token,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        acceptedTerms: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      create: {
        token,
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        acceptedTerms: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    return { pendingToken: token, email, message: "Compte préparé. Complétez maintenant votre entreprise." };
  }

  async createCompany(dto: CreateCompanyDto) {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { token: dto.pendingToken } });
    if (!pending || pending.expiresAt.getTime() < Date.now()) throw new BadRequestException("Inscription expirée. Recommencez la création du compte.");

    const slug = await this.uniqueSlug(dto.companyName);
    const logoUrl = this.uploads.saveDataUrl("tenants", dto.logoDataUrl);
    const userPhotoUrl = this.uploads.saveDataUrl("users", dto.userPhotoDataUrl);

    const profileSlug = dto.businessProfileSlug ?? resolveBusinessProfileSlug(dto.businessCategory, dto.primaryActivity);
    const selectedBusinessProfile = businessProfiles.find((profile) => profile.slug === profileSlug) ?? businessProfiles[0];
    const activityTemplate = findActivityTemplate(dto.primaryActivity ?? dto.industry);

    const result = await this.prisma.$transaction(async (tx) => {
      const savedBusinessModules = new Map<string, string>();
      for (const module of businessModules) {
        const savedModule = await tx.businessModule.upsert({
          where: { key: module.key },
          update: { name: module.name, description: module.description, category: module.category, route: module.route, icon: module.icon, permissions: module.permissions, menuItems: module.menuItems, widgets: module.widgets, offlineReady: Boolean(module.offlineReady), isCore: Boolean(module.isCore), isActive: true },
          create: { key: module.key, name: module.name, description: module.description, category: module.category, route: module.route, icon: module.icon, permissions: module.permissions, menuItems: module.menuItems, widgets: module.widgets, offlineReady: Boolean(module.offlineReady), isCore: Boolean(module.isCore), isActive: true }
        });
        savedBusinessModules.set(module.key, savedModule.id);
      }

      const savedBusinessProfiles = new Map<string, string>();
      for (const profile of businessProfiles) {
        const savedProfile = await tx.businessProfile.upsert({
          where: { slug: profile.slug },
          update: { name: profile.name, description: profile.description, category: profile.category, icon: profile.icon, isActive: true },
          create: { slug: profile.slug, name: profile.name, description: profile.description, category: profile.category, icon: profile.icon, isActive: true }
        });
        savedBusinessProfiles.set(profile.slug, savedProfile.id);
        for (const [index, moduleKey] of profile.modules.entries()) {
          const moduleId = savedBusinessModules.get(moduleKey);
          if (!moduleId) continue;
          await tx.businessModuleAssignment.upsert({
            where: { businessProfileId_businessModuleId: { businessProfileId: savedProfile.id, businessModuleId: moduleId } },
            update: { sortOrder: index, isRequired: true },
            create: { businessProfileId: savedProfile.id, businessModuleId: moduleId, sortOrder: index, isRequired: true }
          });
        }
      }
      const permissions = await Promise.all(defaultPermissions.map((permission) => tx.permission.upsert({
        where: { key: permission.key },
        update: { name: permission.name, category: permission.category, description: permission.description },
        create: { key: permission.key, name: permission.name, category: permission.category, description: permission.description }
      })));

      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug,
          address: dto.address,
          phone: dto.phone,
          email: dto.email ?? pending.email,
          currency: dto.currency ?? "HTG",
          timezone: dto.timezone ?? "America/Port-au-Prince",
          language: dto.language ?? "fr",
          businessCategory: dto.businessCategory,
          primaryActivity: dto.primaryActivity,
          secondaryActivities: dto.secondaryActivities ?? [],
          businessProfileType: selectedBusinessProfile.slug,
          enabledBusinessModules: selectedBusinessProfile.modules,
          status: "TRIAL"
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: pending.email,
          name: `${pending.firstName} ${pending.lastName}`.trim(),
          password: pending.passwordHash
        }
      });

      await tx.companyProfile.create({
        data: {
          tenantId: tenant.id,
          name: dto.companyName,
          companyName: dto.companyName,
          industry: dto.primaryActivity ?? dto.industry,
          logoUrl,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          email: dto.email ?? pending.email,
          website: dto.website,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          taxNumber: dto.taxNumber,
          currency: dto.currency ?? "HTG",
          language: dto.language ?? "fr",
          timezone: dto.timezone ?? "America/Port-au-Prince",
          businessCategory: dto.businessCategory,
          primaryActivity: dto.primaryActivity,
          secondaryActivities: dto.secondaryActivities ?? [],
          businessProfileType: selectedBusinessProfile.slug,
          enabledBusinessModules: selectedBusinessProfile.modules,
          primaryColor: dto.primaryColor,
          secondaryColor: dto.secondaryColor
        }
      });

      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          currency: dto.currency ?? "HTG",
          timezone: dto.timezone ?? "America/Port-au-Prince",
          language: dto.language ?? "fr",
          defaultTaxRate: 0.1,
          invoiceFormat: "LETTER",
          posReceiptFormat: "80",
          allowNegativeStock: false,
          autoPrintReceipt: false,
          businessCategory: dto.businessCategory,
          primaryActivity: dto.primaryActivity,
          secondaryActivities: dto.secondaryActivities ?? [],
          businessProfileType: selectedBusinessProfile.slug,
          enabledBusinessModules: selectedBusinessProfile.modules
        }
      });

      await tx.userProfile.create({ data: { userId: user.id, photoUrl: userPhotoUrl, phone: pending.phone, language: dto.language ?? "fr", jobTitle: "Propriétaire" } });

      const store = await tx.store.create({ data: { tenantId: tenant.id, code: "MAIN", name: "Magasin principal", phone: dto.phone, email: dto.email, country: dto.country, city: dto.city, address: dto.address } });
      const warehouse = await tx.warehouse.create({ data: { tenantId: tenant.id, storeId: store.id, code: "DEPOT-PRINCIPAL", name: "Dépôt principal", description: "Dépôt créé automatiquement pendant l onboarding" } });
      await tx.cashRegister.create({ data: { tenantId: tenant.id, storeId: store.id, code: "CAISSE-01", name: "Caisse principale" } });

      for (const categoryName of activityTemplate.categories) {
        await tx.category.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: this.slug(categoryName) } },
          update: { name: categoryName, isActive: true },
          create: { tenantId: tenant.id, name: categoryName, slug: this.slug(categoryName), isActive: true }
        });
      }

      const role = await tx.role.create({ data: { tenantId: tenant.id, name: "OWNER", description: "Propriétaire de l entreprise", isSystem: true } });
      await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      const businessProfileId = savedBusinessProfiles.get(selectedBusinessProfile.slug);
      if (businessProfileId) {
        await tx.tenantBusinessProfile.create({ data: { tenantId: tenant.id, businessProfileId, isPrimary: true, isActive: true } });
        for (const moduleKey of selectedBusinessProfile.modules) {
          const businessModuleId = savedBusinessModules.get(moduleKey);
          if (!businessModuleId) continue;
          await tx.tenantBusinessModule.upsert({
            where: { tenantId_businessModuleId: { tenantId: tenant.id, businessModuleId } },
            update: { isActive: true, source: "profile", disabledAt: null },
            create: { tenantId: tenant.id, businessModuleId, source: "profile", isActive: true }
          });
        }
      }
      await tx.onboardingState.create({ data: { tenantId: tenant.id, userId: user.id, companyCreated: true, storeCreated: true, warehouseCreated: true, cashRegisterCreated: true, logoUploaded: Boolean(logoUrl), profilePhotoUploaded: Boolean(userPhotoUrl), completed: true } });
      await tx.pendingRegistration.delete({ where: { id: pending.id } });
      return { userId: user.id, tenantId: tenant.id, warehouseId: warehouse.id };
    });

    return this.auth.issueSessionForUser(result.userId, true);
  }

  async status(userId?: string) {
    if (!userId) throw new UnauthorizedException("Session requise");
    if (userId === "usr_admin_vta") return { completed: true, state: null };
    const state = await this.prisma.onboardingState.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    return { completed: Boolean(state?.completed), state };
  }

  private async uniqueSlug(companyName: string) {
    const base = companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "entreprise";
    let slug = base;
    let index = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      index += 1;
      slug = `${base}-${index}`;
    }
    return slug;
  }

  private slug(value: string) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "categorie";
  }
}

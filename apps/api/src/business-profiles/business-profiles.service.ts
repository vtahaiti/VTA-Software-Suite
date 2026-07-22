import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { businessActivityTemplates, businessCategories, businessModules, businessProfiles, businessSectors, resolveBusinessModuleKeys, resolveBusinessProfileSlug } from "./business-catalog";

@Injectable()
export class BusinessProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog() {
    await this.syncCatalog();
    const publicProfiles = businessProfiles.filter((profile) => profile.slug !== "school");
    const publicModules = businessModules.filter((module) => module.key !== "school");
    return { sectors: businessSectors, categories: businessCategories, activityTemplates: businessActivityTemplates, profiles: publicProfiles, modules: publicModules };
  }

  async tenantConfiguration(tenantId: string) {
    await this.syncCatalog();
    await this.ensureTenantDefaultProfile(tenantId);

    const [tenant, profiles, modules] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessCategory: true, primaryActivity: true, secondaryActivities: true, businessProfileType: true, enabledBusinessModules: true }
      }),
      this.prisma.tenantBusinessProfile.findMany({ where: { tenantId }, include: { businessProfile: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
      this.prisma.tenantBusinessModule.findMany({ where: { tenantId, isActive: true }, include: { businessModule: true }, orderBy: { createdAt: "asc" } })
    ]);

    const matrixModuleKeys = resolveBusinessModuleKeys(tenant?.businessProfileType ?? undefined, tenant?.businessCategory ?? undefined, tenant?.primaryActivity ?? undefined);
    const activeModules = modules
      .filter((assignment) => matrixModuleKeys.has(assignment.businessModule.key) || assignment.source === "manual")
      .map((assignment) => this.serializeModule(assignment.businessModule));
    const simpleMenuSections = this.buildSimpleMenuSections(activeModules, tenant?.businessProfileType ?? "commerce", tenant?.primaryActivity);
    const expertMenuSections = this.buildExpertMenuSections(activeModules, tenant?.businessProfileType ?? "commerce", tenant?.primaryActivity);

    return {
      profiles: profiles.map((assignment) => ({
        id: assignment.businessProfile.id,
        slug: assignment.businessProfile.slug,
        name: assignment.businessProfile.name,
        description: assignment.businessProfile.description,
        category: assignment.businessProfile.category,
        icon: assignment.businessProfile.icon,
        isPrimary: assignment.isPrimary,
        isActive: assignment.isActive
      })),
      modules: activeModules,
      simpleMenuSections,
      expertMenuSections,
      menuSections: simpleMenuSections,
      widgets: this.buildWidgets(activeModules),
      businessCategory: tenant?.businessCategory ?? "commerce",
      primaryActivity: tenant?.primaryActivity ?? "Boutique / Market",
      secondaryActivities: tenant?.secondaryActivities ?? [],
      businessProfileType: tenant?.businessProfileType ?? "commerce",
      enabledBusinessModules: activeModules.map((module) => module.key),
      sectors: businessSectors,
      categories: businessCategories,
      offline: { prepared: true, message: "Mode hors ligne prepare pour synchronisation future." }
    };
  }

  async dashboard(tenantId: string) {
    const configuration = await this.tenantConfiguration(tenantId);
    const activeProfileNames = configuration.profiles.filter((profile) => profile.isActive).map((profile) => profile.name);
    return {
      activeProfiles: activeProfileNames,
      modules: configuration.modules.map((module) => ({ key: module.key, name: module.name, route: module.route, category: module.category })),
      widgets: configuration.widgets.slice(0, 8)
    };
  }

  async activateProfile(tenantId: string, slug: string, isPrimary = false) {
    await this.syncCatalog();
    const profile = await this.prisma.businessProfile.findUnique({ where: { slug }, include: { modules: { include: { businessModule: true } } } });
    if (!profile) throw new NotFoundException("Profil métier introuvable.");

    await this.prisma.$transaction(async (tx) => {
      if (isPrimary) await tx.tenantBusinessProfile.updateMany({ where: { tenantId }, data: { isPrimary: false } });
      await tx.tenantBusinessProfile.upsert({
        where: { tenantId_businessProfileId: { tenantId, businessProfileId: profile.id } },
        update: { isActive: true, isPrimary, disabledAt: null },
        create: { tenantId, businessProfileId: profile.id, isPrimary, isActive: true }
      });

      for (const assignment of profile.modules) {
        await tx.tenantBusinessModule.upsert({
          where: { tenantId_businessModuleId: { tenantId, businessModuleId: assignment.businessModuleId } },
          update: { isActive: true, source: "profile", disabledAt: null },
          create: { tenantId, businessModuleId: assignment.businessModuleId, source: "profile", isActive: true }
        });
      }
    });

    const configuration = await this.tenantConfiguration(tenantId);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { businessProfileType: slug, enabledBusinessModules: configuration.modules.map((module) => module.key) } }).catch(() => undefined);
    return configuration;
  }

  async deactivateProfile(tenantId: string, slug: string) {
    await this.syncCatalog();
    const profile = await this.prisma.businessProfile.findUnique({ where: { slug } });
    if (!profile) throw new NotFoundException("Profil métier introuvable.");
    const activeCount = await this.prisma.tenantBusinessProfile.count({ where: { tenantId, isActive: true } });
    if (activeCount <= 1) throw new BadRequestException("Au moins un profil métier doit rester actif.");
    await this.prisma.tenantBusinessProfile.update({ where: { tenantId_businessProfileId: { tenantId, businessProfileId: profile.id } }, data: { isActive: false, isPrimary: false, disabledAt: new Date() } });
    await this.rebuildTenantModules(tenantId);
    const configuration = await this.tenantConfiguration(tenantId);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { enabledBusinessModules: configuration.modules.map((module) => module.key) } }).catch(() => undefined);
    return configuration;
  }

  async setModuleState(tenantId: string, key: string, isActive: boolean) {
    await this.syncCatalog();
    const module = await this.prisma.businessModule.findUnique({ where: { key } });
    if (!module) throw new NotFoundException("Module métier introuvable.");
    await this.prisma.tenantBusinessModule.upsert({
      where: { tenantId_businessModuleId: { tenantId, businessModuleId: module.id } },
      update: { isActive, source: "manual", disabledAt: isActive ? null : new Date() },
      create: { tenantId, businessModuleId: module.id, source: "manual", isActive, disabledAt: isActive ? null : new Date() }
    });
    const configuration = await this.tenantConfiguration(tenantId);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { enabledBusinessModules: configuration.modules.map((item) => item.key) } }).catch(() => undefined);
    return configuration;
  }

  async assignBusinessSelection(tenantId: string, categoryKey?: string, primaryActivity?: string, secondaryActivities: string[] = []) {
    await this.syncCatalog();
    const profileSlug = resolveBusinessProfileSlug(categoryKey, primaryActivity);
    const [tenant, profile, selectedModules] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      this.prisma.businessProfile.findUnique({ where: { slug: profileSlug } }),
      this.prisma.businessModule.findMany({
        where: { key: { in: Array.from(resolveBusinessModuleKeys(profileSlug, categoryKey, primaryActivity)) } },
        select: { id: true, key: true }
      })
    ]);
    if (!profile) throw new NotFoundException("Profil métier introuvable.");
    const moduleIds = selectedModules.map((module) => module.id);
    const moduleKeys = selectedModules.map((module) => module.key);
    const nextCategory = categoryKey ?? "commerce";
    const nextActivity = primaryActivity ?? "Boutique / Market";

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantBusinessProfile.updateMany({
        where: { tenantId },
        data: { isActive: false, isPrimary: false, disabledAt: new Date() }
      });
      await tx.tenantBusinessProfile.upsert({
        where: { tenantId_businessProfileId: { tenantId, businessProfileId: profile.id } },
        update: { isActive: true, isPrimary: true, disabledAt: null },
        create: { tenantId, businessProfileId: profile.id, isPrimary: true, isActive: true }
      });
      await tx.tenantBusinessModule.updateMany({
        where: { tenantId, source: "profile", businessModuleId: { notIn: moduleIds } },
        data: { isActive: false, disabledAt: new Date() }
      });
      for (const module of selectedModules) {
        await tx.tenantBusinessModule.upsert({
          where: { tenantId_businessModuleId: { tenantId, businessModuleId: module.id } },
          update: { isActive: true, source: "profile", disabledAt: null },
          create: { tenantId, businessModuleId: module.id, source: "profile", isActive: true }
        });
      }
      const profileData = {
        businessCategory: nextCategory,
        primaryActivity: nextActivity,
        secondaryActivities,
        businessProfileType: profileSlug,
        enabledBusinessModules: moduleKeys
      };
      await tx.tenant.update({ where: { id: tenantId }, data: profileData });
      await tx.tenantSettings.upsert({
        where: { tenantId },
        update: profileData,
        create: {
          tenantId,
          currency: "HTG",
          timezone: "America/Port-au-Prince",
          language: "fr",
          ...profileData
        }
      });
      await tx.companyProfile.upsert({
        where: { tenantId },
        update: { ...profileData, industry: nextActivity },
        create: {
          tenantId,
          name: tenant?.name ?? "Mon entreprise",
          companyName: tenant?.name ?? "Mon entreprise",
          industry: nextActivity,
          ...profileData
        }
      });
    });
    return this.tenantConfiguration(tenantId);
  }

  async assignInitialProfile(tenantId: string, slug?: string) {
    const configuration = await this.activateProfile(tenantId, slug || "commerce", true);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { businessCategory: "commerce", primaryActivity: "Boutique / Market", businessProfileType: slug || "commerce", enabledBusinessModules: configuration.modules.map((module) => module.key) } }).catch(() => undefined);
    return configuration;
  }

  async syncCatalog() {
    for (const module of businessModules) {
      await this.prisma.businessModule.upsert({
        where: { key: module.key },
        update: { name: module.name, description: module.description, category: module.category, route: module.route, icon: module.icon, permissions: module.permissions, menuItems: module.menuItems, widgets: module.widgets, offlineReady: Boolean(module.offlineReady), isCore: Boolean(module.isCore), isActive: true },
        create: { key: module.key, name: module.name, description: module.description, category: module.category, route: module.route, icon: module.icon, permissions: module.permissions, menuItems: module.menuItems, widgets: module.widgets, offlineReady: Boolean(module.offlineReady), isCore: Boolean(module.isCore), isActive: true }
      });
    }

    for (const profile of businessProfiles) {
      const savedProfile = await this.prisma.businessProfile.upsert({
        where: { slug: profile.slug },
        update: { name: profile.name, description: profile.description, category: profile.category, icon: profile.icon, isActive: true },
        create: { slug: profile.slug, name: profile.name, description: profile.description, category: profile.category, icon: profile.icon, isActive: true }
      });
      const desiredModuleIds: string[] = [];
      for (const [index, moduleKey] of profile.modules.entries()) {
        const savedModule = await this.prisma.businessModule.findUnique({ where: { key: moduleKey } });
        if (!savedModule) continue;
        desiredModuleIds.push(savedModule.id);
        await this.prisma.businessModuleAssignment.upsert({
          where: { businessProfileId_businessModuleId: { businessProfileId: savedProfile.id, businessModuleId: savedModule.id } },
          update: { sortOrder: index, isRequired: true },
          create: { businessProfileId: savedProfile.id, businessModuleId: savedModule.id, sortOrder: index, isRequired: true }
        });
      }
      await this.prisma.businessModuleAssignment.deleteMany({
        where: {
          businessProfileId: savedProfile.id,
          businessModuleId: { notIn: desiredModuleIds }
        }
      });
    }
  }

  private async ensureTenantDefaultProfile(tenantId: string) {
    const count = await this.prisma.tenantBusinessProfile.count({ where: { tenantId } });
    if (count === 0) await this.assignInitialProfile(tenantId, "commerce");
  }

  private async rebuildTenantModules(tenantId: string) {
    const profiles = await this.prisma.tenantBusinessProfile.findMany({ where: { tenantId, isActive: true }, include: { businessProfile: { include: { modules: true } } } });
    const activeModuleIds = new Set<string>();
    for (const profile of profiles) for (const assignment of profile.businessProfile.modules) activeModuleIds.add(assignment.businessModuleId);
    const assignedModules = await this.prisma.tenantBusinessModule.findMany({ where: { tenantId } });
    for (const module of assignedModules) await this.prisma.tenantBusinessModule.update({ where: { id: module.id }, data: { isActive: activeModuleIds.has(module.businessModuleId), disabledAt: activeModuleIds.has(module.businessModuleId) ? null : new Date() } });
  }

  private serializeModule(module: { key: string; name: string; description: string | null; category: string; route: string | null; icon: string | null; permissions: string[]; menuItems: unknown; widgets: unknown; offlineReady: boolean; isCore: boolean }) {
    return {
      key: module.key,
      name: module.name,
      description: module.description,
      category: module.category,
      route: module.route,
      icon: module.icon,
      permissions: module.permissions,
      menuItems: Array.isArray(module.menuItems) ? module.menuItems as Array<{ label: string; href: string; section: string }> : [],
      widgets: Array.isArray(module.widgets) ? module.widgets as Array<{ key: string; label: string; description: string }> : [],
      offlineReady: module.offlineReady,
      isCore: module.isCore
    };
  }

  private buildSimpleMenuSections(modules: Array<ReturnType<BusinessProfilesService["serializeModule"]>>, profileType = "commerce", primaryActivity?: string | null) {
    const activeKeys = new Set(modules.map((module) => module.key));
    const specialized = this.resolveSimpleMenu(profileType, primaryActivity);
    const items = this.withCommonCapabilities(specialized, activeKeys)
      .filter((item) => activeKeys.has(item.module))
      .map(({ module: _module, ...item }) => { void _module; return item; });
    return [{ title: "Menu", items }];
  }

  private withCommonCapabilities(items: Array<{ label: string; href: string; module: string }>, activeKeys: Set<string>) {
    const commonItems: Array<{ label: string; href: string; module: string }> = [
      { label: "Accueil", href: "/dashboard", module: "dashboard" },
      { label: "Nouvelle vente", href: "/dashboard/pos", module: "pos" },
      { label: "Ventes en attente", href: "/dashboard/sales/in-progress", module: "pos" },
      { label: "Historique des ventes", href: "/dashboard/sales/completed", module: "pos" },
      { label: "Devis & Commandes", href: "/dashboard/sales", module: "sales" },
      { label: "Produits", href: "/dashboard/products", module: "products" },
      { label: "Catégories", href: "/dashboard/products/categories", module: "products" },
      { label: "Inventaire", href: "/dashboard/inventory", module: "inventory" },
      { label: "Clients", href: "/dashboard/customers", module: "customers" },
      { label: "Fournisseurs", href: "/dashboard/suppliers", module: "suppliers" },
      { label: "Achats", href: "/dashboard/purchases", module: "suppliers" },
      { label: "Rapports", href: "/dashboard/reports", module: "reports" },
      { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" },
      { label: "Abonnement", href: "/dashboard/settings/subscription", module: "settings" },
      { label: "Emails", href: "/dashboard/settings/emails", module: "settings" }
    ];
    const merged = new Map<string, { label: string; href: string; module: string }>();
    for (const item of [...items, ...commonItems]) {
      if (!activeKeys.has(item.module) || merged.has(item.href)) continue;
      merged.set(item.href, item);
    }
    return Array.from(merged.values());
  }

  private resolveSimpleMenu(profileType = "commerce", primaryActivity?: string | null) {
    const activity = (primaryActivity ?? "").toLowerCase();
    const normalizedProfile = profileType === "windows-aluminium" || profileType === "manufacturing" || activity.includes("aluminium") || activity.includes("fabrication") ? "production" : profileType === "hotel-restaurant" ? "hotel" : profileType;
    if (normalizedProfile === "restaurant") {
      return [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "POS / Nouvelle commande", href: "/dashboard/pos", module: "pos" },
        { label: "Commandes ouvertes", href: "/dashboard/sales/in-progress", module: "pos" },
        { label: "Historique ventes", href: "/dashboard/sales/completed", module: "pos" },
        { label: "Produits / menus", href: "/dashboard/products", module: "products" },
        { label: "Catégories", href: "/dashboard/products/categories", module: "products" },
        { label: "Stock ingrédients / Inventaire", href: "/dashboard/inventory", module: "inventory" },
        { label: "Clients", href: "/dashboard/customers", module: "customers" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Notifications", href: "/dashboard/notifications", module: "dashboard" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ];
    }
    const menus: Record<string, Array<{ label: string; href: string; module: string }>> = {
      commerce: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "Nouvelle vente", href: "/dashboard/pos", module: "pos" },
        { label: "Produits", href: "/dashboard/products", module: "products" },
        { label: "Stock", href: "/dashboard/inventory", module: "inventory" },
        { label: "Clients", href: "/dashboard/customers", module: "customers" },
        { label: "Fournisseurs", href: "/dashboard/suppliers", module: "suppliers" },
        { label: "Achats", href: "/dashboard/purchases", module: "suppliers" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      pharmacy: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "POS Pharmacie", href: "/dashboard/pos", module: "pos" },
        { label: "Médicaments", href: "/dashboard/products", module: "products" },
        { label: "Stock", href: "/dashboard/inventory", module: "inventory" },
        { label: "Patients", href: "/dashboard/customers", module: "customers" },
        { label: "Ordonnances", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Fournisseurs", href: "/dashboard/suppliers", module: "suppliers" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      clinic: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "Patients", href: "/dashboard/customers", module: "customers" },
        { label: "Rendez-vous", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Consultations", href: "/dashboard/sales", module: "sales" },
        { label: "Traitements", href: "/dashboard/products", module: "sales" },
        { label: "Prescriptions", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Facturation", href: "/dashboard/sales/invoices", module: "sales" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      restaurant: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "POS / Nouvelle commande", href: "/dashboard/pos", module: "pos" },
        { label: "Commandes ouvertes", href: "/dashboard/sales/in-progress", module: "pos" },
        { label: "Historique ventes", href: "/dashboard/sales/completed", module: "pos" },
        { label: "Produits / Menus", href: "/dashboard/products", module: "products" },
        { label: "Catégories", href: "/dashboard/products/categories", module: "products" },
        { label: "Stock ingrédients / Inventaire", href: "/dashboard/inventory", module: "inventory" },
        { label: "Clients", href: "/dashboard/customers", module: "customers" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Notifications", href: "/dashboard/notifications", module: "dashboard" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      hotel: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "Réservations", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Chambres", href: "/dashboard/stores", module: "hotel" },
        { label: "Clients", href: "/dashboard/customers", module: "customers" },
        { label: "Paiements", href: "/dashboard/payments", module: "sales" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      school: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "Élèves", href: "/dashboard/customers", module: "customers" },
        { label: "Paiements", href: "/dashboard/payments", module: "sales" },
        { label: "Classes", href: "/dashboard/stores", module: "school" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      garage: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "Véhicules", href: "/dashboard/customers", module: "customers" },
        { label: "Clients", href: "/dashboard/customers", module: "customers" },
        { label: "Réparations", href: "/dashboard/sales/invoices", module: "sales" },
        { label: "Rendez-vous", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Pièces", href: "/dashboard/products", module: "products" },
        { label: "Facturation", href: "/dashboard/sales/invoices", module: "sales" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ],
      production: [
        { label: "Accueil", href: "/dashboard", module: "dashboard" },
        { label: "Devis", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Projets", href: "/dashboard/sales", module: "sales" },
        { label: "Fabrication", href: "/dashboard/sales/quotes", module: "sales" },
        { label: "Installation", href: "/dashboard/sales/invoices", module: "sales" },
        { label: "Matières premières", href: "/dashboard/inventory", module: "inventory" },
        { label: "Produits finis", href: "/dashboard/products", module: "products" },
        { label: "Clients", href: "/dashboard/customers", module: "customers" },
        { label: "Rapports", href: "/dashboard/reports", module: "reports" },
        { label: "Paramètres", href: "/dashboard/settings/company", module: "settings" }
      ]
    };
    return menus[normalizedProfile] ?? menus.commerce;
  }

  private buildExpertMenuSections(modules: Array<ReturnType<BusinessProfilesService["serializeModule"]>>, profileType = "commerce", primaryActivity?: string | null) {
    const simpleItems = this.buildSimpleMenuSections(modules, profileType, primaryActivity)[0].items;
    return [
      { title: "Menu", items: simpleItems },
      { title: "Paramètres avancés", items: [
        { label: "Import / Export", href: "/dashboard/import-export" },
        { label: "Audit", href: "/dashboard/audit" },
        { label: "Permissions", href: "/dashboard/settings/permissions" },
        { label: "Sauvegardes", href: "/dashboard/backups" },
        { label: "Modules métier", href: "/dashboard/settings/business-modules" },
        { label: "Taxes", href: "/dashboard/settings/invoicing" }
      ] }
    ];
  }

  private buildMenuSections(modules: Array<ReturnType<BusinessProfilesService["serializeModule"]>>) {
    const order = ["Principal", "Produits", "Stock", "Achats", "Ventes", "Restaurant", "Automobile", "Impression", "Hôtel", "Éducation", "Services", "Paramètres"];
    const grouped = new Map<string, Array<{ label: string; href: string }>>();
    const seen = new Set<string>();
    for (const module of modules) for (const item of module.menuItems) {
      const key = `${item.section}:${item.href}:${item.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entries = grouped.get(item.section) ?? [];
      entries.push({ label: item.label, href: item.href });
      grouped.set(item.section, entries);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([title, items]) => ({ title, items }));
  }

  private buildWidgets(modules: Array<ReturnType<BusinessProfilesService["serializeModule"]>>) {
    const important = new Set(["sales-today", "low-stock", "invoices", "products", "stock-by-store"]);
    const widgets = new Map<string, { key: string; label: string; description: string; module: string }>();
    for (const module of modules) for (const widget of module.widgets) if (!widgets.has(widget.key)) widgets.set(widget.key, { ...widget, module: module.name });
    return Array.from(widgets.values()).sort((a, b) => Number(!important.has(a.key)) - Number(!important.has(b.key)));
  }
}

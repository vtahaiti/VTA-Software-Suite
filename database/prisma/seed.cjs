const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "vta-enterprise" },
    update: { name: "VTA Enterprise", status: "ACTIVE" },
    create: {
      id: "tenant_vta",
      name: "VTA Enterprise",
      slug: "vta-enterprise",
      email: "admin@vta.ht",
      currency: "HTG",
      timezone: "America/Port-au-Prince",
      language: "fr",
      status: "ACTIVE"
    }
  });

  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Owner" } },
    update: { description: "Proprietaire du tenant", isSystem: true },
    create: { tenantId: tenant.id, name: "Owner", description: "Proprietaire du tenant", isSystem: true }
  });

  const platformRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "PlatformAdmin" } },
    update: { description: "Ancien administrateur plateforme VTA", isSystem: true },
    create: { tenantId: tenant.id, name: "PlatformAdmin", description: "Ancien administrateur plateforme VTA", isSystem: true }
  });

  const superAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "SUPER_ADMIN" } },
    update: { description: "Super administrateur global VTA ERP", isSystem: true },
    create: { tenantId: tenant.id, name: "SUPER_ADMIN", description: "Super administrateur global VTA ERP", isSystem: true }
  });

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@vta.ht" } },
    update: {
      name: "Administrateur VTA",
      password: await bcrypt.hash("admin123", 12)
    },
    create: {
      id: "usr_admin_vta",
      tenantId: tenant.id,
      name: "Administrateur VTA",
      email: "admin@vta.ht",
      password: await bcrypt.hash("admin123", 12)
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id }
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id, roleId: platformRole.id } });

  const platformUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@vtaerp.local" } },
    update: {
      name: "Super Admin VTA",
      password: await bcrypt.hash("Admin@123456", 12)
    },
    create: {
      id: "usr_platform_admin_vta",
      tenantId: tenant.id,
      name: "Super Admin VTA",
      email: "admin@vtaerp.local",
      password: await bcrypt.hash("Admin@123456", 12)
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: platformUser.id, roleId: platformRole.id } },
    update: {},
    create: { userId: platformUser.id, roleId: platformRole.id }
  });

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "admin@vtaerp.com").toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin@123456";

  const platformUserCom = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: superAdminEmail } },
    update: {
      name: "Super Admin VTA ERP",
      password: await bcrypt.hash(superAdminPassword, 12),
      isActive: true
    },
    create: {
      id: "usr_platform_admin_vta_com",
      tenantId: tenant.id,
      name: "Super Admin VTA ERP",
      email: superAdminEmail,
      password: await bcrypt.hash(superAdminPassword, 12),
      isActive: true
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: platformUserCom.id, roleId: platformRole.id } },
    update: {},
    create: { userId: platformUserCom.id, roleId: platformRole.id }
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: platformUserCom.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: platformUserCom.id, roleId: superAdminRole.id }
  });

  console.log(`Seed termine: admin@vta.ht / admin123, admin@vtaerp.local / Admin@123456 et ${superAdminEmail} / mot de passe SUPER_ADMIN configure`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

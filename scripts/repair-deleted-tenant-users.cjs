#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const root = path.resolve(__dirname, "..");
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const apply = args.has("--apply");
const confirm = rawArgs.find((arg) => arg.startsWith("--confirm="))?.split("=").slice(1).join("=");
const tenantIdFilter = rawArgs.find((arg) => arg.startsWith("--tenant-id="))?.split("=").slice(1).join("=");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function deletedUserEmail(userId) {
  return `deleted+${userId}@deleted.vtaerp.local`;
}

function isAlreadyAnonymized(user) {
  return user.email === deletedUserEmail(user.id);
}

function placeholders(start, count) {
  return Array.from({ length: count }, (_, index) => `$${start + index}`).join(", ");
}

function countFromRow(row) {
  return Number(row?.count ?? 0);
}

function safeTenant(tenant, usersTotal, usersToAnonymize, resetTokensToInvalidate, pendingRegistrationsToDelete) {
  return {
    tenantId: tenant.id,
    status: tenant.status,
    deletedAt: tenant.deletedAt,
    usersTotal,
    usersToAnonymize,
    resetTokensToInvalidate,
    pendingRegistrationsToDelete
  };
}

async function hasColumn(prisma, tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    tableName,
    columnName
  );
  return rows.length > 0;
}

async function findDeletedTenants(prisma) {
  const hasDeletedAt = await hasColumn(prisma, "Tenant", "deletedAt");
  const deletedAtSelect = hasDeletedAt ? `"deletedAt"` : `NULL::timestamp AS "deletedAt"`;
  const orderBy = hasDeletedAt ? `"deletedAt" DESC NULLS LAST, id ASC` : `id ASC`;
  const params = [];
  let where = `status::text = 'DELETED'`;
  if (tenantIdFilter) {
    params.push(tenantIdFilter);
    where += ` AND id = $1`;
  }
  return prisma.$queryRawUnsafe(
    `SELECT id, name, status::text AS status, ${deletedAtSelect} FROM "Tenant" WHERE ${where} ORDER BY ${orderBy}`,
    ...params
  );
}

async function findTenantUsers(prisma, tenantId) {
  return prisma.$queryRawUnsafe(
    `SELECT id, email, "isActive" FROM "User" WHERE "tenantId" = $1 ORDER BY id ASC`,
    tenantId
  );
}

async function countResetTokens(prisma, userIds) {
  if (!userIds.length) return 0;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "PasswordResetToken" WHERE "usedAt" IS NULL AND "userId" IN (${placeholders(1, userIds.length)})`,
    ...userIds
  );
  return countFromRow(rows[0]);
}

async function countPendingRegistrations(prisma, emails) {
  if (!emails.length) return 0;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "PendingRegistration" WHERE email IN (${placeholders(1, emails.length)})`,
    ...emails
  );
  return countFromRow(rows[0]);
}

async function main() {
  loadEnvFile();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant.");
  if (apply && confirm !== "ANONYMIZE_DELETED_TENANT_USERS") {
    throw new Error("Refus: utilisez --apply --confirm=ANONYMIZE_DELETED_TENANT_USERS pour modifier la base.");
  }

  const prisma = new PrismaClient();
  try {
    const tenants = await findDeletedTenants(prisma);
    const plan = [];

    for (const tenant of tenants) {
      const users = await findTenantUsers(prisma, tenant.id);
      const usersToAnonymize = users.filter((user) => !isAlreadyAnonymized(user));
      const userIds = users.map((user) => user.id);
      const userEmailsToRelease = usersToAnonymize.map((user) => user.email);
      const [resetTokensToInvalidate, pendingRegistrationsToDelete] = await Promise.all([
        countResetTokens(prisma, userIds),
        countPendingRegistrations(prisma, userEmailsToRelease)
      ]);
      plan.push({
        tenant,
        users,
        usersToAnonymize,
        userIds,
        userEmailsToRelease,
        resetTokensToInvalidate,
        pendingRegistrationsToDelete
      });
    }

    const summary = {
      mode: apply ? "apply" : "dry-run",
      tenantFilter: tenantIdFilter ?? null,
      tenantsDeletedFound: tenants.length,
      tenantsAffected: plan.filter((entry) => entry.usersToAnonymize.length || entry.resetTokensToInvalidate || entry.pendingRegistrationsToDelete).length,
      usersToAnonymize: plan.reduce((sum, entry) => sum + entry.usersToAnonymize.length, 0),
      resetTokensToInvalidate: plan.reduce((sum, entry) => sum + entry.resetTokensToInvalidate, 0),
      pendingRegistrationsToDelete: plan.reduce((sum, entry) => sum + entry.pendingRegistrationsToDelete, 0),
      tenants: plan.map((entry) =>
        safeTenant(
          entry.tenant,
          entry.users.length,
          entry.usersToAnonymize.length,
          entry.resetTokensToInvalidate,
          entry.pendingRegistrationsToDelete
        )
      )
    };

    if (!apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const applied = await prisma.$transaction(async (tx) => {
      const result = [];
      for (const entry of plan) {
        if (!entry.usersToAnonymize.length && !entry.resetTokensToInvalidate && !entry.pendingRegistrationsToDelete) {
          result.push({ tenantId: entry.tenant.id, skipped: true, reason: "already-clean" });
          continue;
        }

        const currentTenantRows = await tx.$queryRawUnsafe(
          `SELECT status::text AS status FROM "Tenant" WHERE id = $1 FOR UPDATE`,
          entry.tenant.id
        );
        const currentTenant = currentTenantRows[0];
        if (!currentTenant || currentTenant.status !== "DELETED") {
          throw new Error(`Refus: tenant ${entry.tenant.id} n'est pas DELETED.`);
        }

        for (const user of entry.usersToAnonymize) {
          await tx.$executeRawUnsafe(
            `UPDATE "User" SET "isActive" = false, email = $1, "updatedAt" = NOW() WHERE id = $2 AND "tenantId" = $3 AND email <> $1`,
            deletedUserEmail(user.id),
            user.id,
            entry.tenant.id
          );
        }

        if (entry.userIds.length) {
          await tx.$executeRawUnsafe(
            `UPDATE "User" SET "isActive" = false, "updatedAt" = NOW() WHERE "tenantId" = $1 AND id IN (${placeholders(2, entry.userIds.length)})`,
            entry.tenant.id,
            ...entry.userIds
          );
          await tx.$executeRawUnsafe(
            `UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "usedAt" IS NULL AND "userId" IN (${placeholders(1, entry.userIds.length)})`,
            ...entry.userIds
          );
        }

        if (entry.userEmailsToRelease.length) {
          await tx.$executeRawUnsafe(
            `DELETE FROM "PendingRegistration" WHERE email IN (${placeholders(1, entry.userEmailsToRelease.length)})`,
            ...entry.userEmailsToRelease
          );
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO "AuditLog" ("id", "tenantId", "tenantName", "action", "entity", "entityId", "message", "metadata", "createdAt")
           VALUES ($1, $2, $3, 'UPDATE', 'PLATFORM_DELETED_TENANT_REPAIR', $2, $4, $5::jsonb, NOW())`,
          randomUUID(),
          entry.tenant.id,
          entry.tenant.name,
          "Reparation idempotente des utilisateurs d'un tenant supprime.",
          JSON.stringify({
            mode: "repair-deleted-tenant-users",
            usersAnonymized: entry.usersToAnonymize.length,
            resetTokensInvalidated: entry.resetTokensToInvalidate,
            pendingRegistrationsDeleted: entry.pendingRegistrationsToDelete
          })
        );

        result.push({
          tenantId: entry.tenant.id,
          usersAnonymized: entry.usersToAnonymize.length,
          resetTokensInvalidated: entry.resetTokensToInvalidate,
          pendingRegistrationsDeleted: entry.pendingRegistrationsToDelete
        });
      }
      return result;
    });

    console.log(JSON.stringify({ ...summary, applied }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exit(1);
});

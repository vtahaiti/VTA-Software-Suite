const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  {
    name: "products API uses paginated select instead of full relation include for list",
    file: "apps/api/src/products/products.service.ts",
    expect: [
      "const productListSelect",
      "select: productListSelect",
      "skip: (page - 1) * limit",
      "take: limit"
    ],
    reject: ["findMany({ where, include: productInclude, skip:"]
  },
  {
    name: "POS product search is paginated and returns narrow product fields",
    file: "apps/api/src/pos/pos.service.ts",
    expect: [
      "async searchProducts",
      "take: limit",
      "barcodes: { select:",
      "images: { select:"
    ]
  },
  {
    name: "sales list keeps pagination in SQL for completed sales",
    file: "apps/api/src/sales/sales.service.ts",
    expect: [
      "const saleListSelect",
      "skip: (page - 1) * limit",
      "take: limit",
      "select: saleListSelect"
    ],
    reject: ["Math.max(limit * page * 3, 100)", "normalized.slice((page - 1) * limit"]
  },
  {
    name: "sales API caps list page size",
    file: "apps/api/src/sales/dto/sale-query.dto.ts",
    expect: ["@Max(100)", "limit?: number = 20"]
  },
  {
    name: "customers page shows loading/error states instead of temporary false zero",
    file: "apps/web/app/dashboard/customers/page.tsx",
    expect: ["isLoading", "Chargement des clients", "Impossible de charger les clients"]
  },
  {
    name: "sales page shows loading state and paginates list fetches",
    file: "apps/web/app/dashboard/sales/sales-status-page.tsx",
    expect: ["limit: \"25\"", "Chargement des ventes", "Pagination"]
  },
  {
    name: "Prisma schema contains compound tenant list indexes",
    file: "database/prisma/schema.prisma",
    expect: [
      "@@index([tenantId, isActive, name])",
      "@@index([tenantId, isActive, createdAt])",
      "@@index([tenantId, status, createdAt])"
    ]
  },
  {
    name: "performance migration creates non-destructive list indexes",
    file: "database/prisma/migrations/20260712023000_performance_list_indexes/migration.sql",
    expect: [
      "CREATE INDEX IF NOT EXISTS",
      "\"Product_tenantId_isActive_name_idx\"",
      "\"Sale_tenantId_status_createdAt_idx\"",
      "\"Customer_tenantId_status_createdAt_idx\""
    ]
  }
];

const failures = [];
for (const check of checks) {
  const content = read(check.file);
  for (const expected of check.expect ?? []) {
    if (!content.includes(expected)) failures.push(`${check.name}: missing ${expected}`);
  }
  for (const rejected of check.reject ?? []) {
    if (content.includes(rejected)) failures.push(`${check.name}: forbidden ${rejected}`);
  }
}

if (failures.length) {
  console.error("Performance list contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Performance list contract passed (${checks.length} checks).`);

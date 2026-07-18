const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertContains(file, text, message) {
  const source = read(file);
  if (!source.includes(text)) throw new Error(`${message}: ${text}`);
}

function assertRegex(file, pattern, message) {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(message);
}

const saleDto = "apps/api/src/sales/dto/sale-query.dto.ts";
const salesService = "apps/api/src/sales/sales.service.ts";
const salesController = "apps/api/src/sales/sales.controller.ts";
const printService = "apps/api/src/print/invoice-print.service.ts";
const timezone = "apps/api/src/common/business-timezone.ts";
const webSales = "apps/web/app/dashboard/sales/sales-status-page.tsx";
const schema = "database/prisma/schema.prisma";

assertContains(schema, "createdById   String?", "Sale must keep creator id");
assertContains(schema, "@@index([createdById])", "Sale creator id must be indexed");

assertContains(saleDto, "cashierId", "Sales query must support cashier filter");
assertContains(saleDto, "\"today\", \"week\", \"month\", \"custom\"", "Sales query must support period filter");
assertContains(salesController, "this.service.findAll(req.user.tenantId, query, req.user)", "Controller must pass authenticated user to sales listing");

assertContains(salesService, "createdById: true", "Sales list must select sale creator");
assertContains(salesService, "createdByUserName", "Sales list must expose a displayable creator name");
assertContains(salesService, "sales.view_all", "Manager full sales view must require explicit permission");
assertContains(salesService, "forcedUserId", "Cashier/limited users must be forced to their own sales");
assertContains(salesService, "ForbiddenException", "Direct access to another cashier must be forbidden");
assertContains(salesService, "salesSummary", "Sales listing must return filtered summary");
assertContains(salesService, "cashierOptions", "Sales listing must return cashier filter options");
assertContains(salesService, "businessDayRange", "Sales periods must use business timezone day range");
assertContains(salesService, "businessWeekRange", "Sales periods must use business timezone week range");
assertContains(salesService, "businessMonthRange", "Sales periods must use business timezone month range");
assertContains(timezone, "businessWeekRange", "Business timezone week helper missing");

assertContains(printService, "sale.createdById", "Receipt print must use sale creator, not printer");
assertRegex(printService, /Caissier[\s\S]*cashier\?\.name/, "Receipt must print creator cashier name");

assertContains(webSales, "Tous les caissiers", "Admin/owner sales history must offer all cashier filter");
assertContains(webSales, "Vos ventes uniquement", "Cashier sales history must hide all-cashier filter");
assertContains(webSales, "createdByUserName", "Sales history must display cashier name");
assertContains(webSales, "summary?.averageBasket", "Sales history must show average basket");
assertContains(webSales, "period === \"custom\"", "Sales history must support custom period");

console.log("sales-cashier-reporting contract smoke: OK");

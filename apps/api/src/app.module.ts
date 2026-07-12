import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AdjustmentModule } from "./adjustments/adjustment.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BackupModule } from "./backup/backup.module";
import { BusinessProfilesModule } from "./business-profiles/business-profiles.module";
import { AuthenticationMiddleware } from "./auth/middleware/authentication.middleware";
import { CashRegisterModule } from "./cash-register/cash-register.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { VersionModule } from "./version/version.module";
import { InventoryModule } from "./inventory/inventory.module";
import { ImportExportModule } from "./import-export/import-export.module";
import { MovementModule } from "./movements/movement.module";
import { PaymentModule } from "./payments/payment.module";
import { UploadsModule } from "./uploads/uploads.module";
import { ProfileModule } from "./profile/profile.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { PlatformModule } from "./platform/platform.module";
import { PosModule } from "./pos/pos.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { RbacContextMiddleware } from "./rbac/middleware/rbac-context.middleware";
import { RbacModule } from "./rbac/rbac.module";
import { ReceiptModule } from "./receipts/receipt.module";
import { ReportsModule } from "./reports/reports.module";
import { RolesModule } from "./roles/roles.module";
import { SalesModule } from "./sales/sales.module";
import { SettingsModule } from "./settings/settings.module";
import { SecurityModule } from "./security/security.module";
import { StockModule } from "./stock/stock.module";
import { StoresModule } from "./stores/stores.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { TenantContextMiddleware } from "./tenants/middleware/tenant-context.middleware";
import { TenantsModule } from "./tenants/tenants.module";
import { UserRolesModule } from "./user-roles/user-roles.module";
import { UsersModule } from "./users/users.module";
import { WarehouseModule } from "./warehouses/warehouse.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    VersionModule,
    UploadsModule,
    ProfileModule,
    OnboardingModule,
    AuthModule,
    SecurityModule,
    AuditLogsModule,
    AuditModule,
    BackupModule,
    BusinessProfilesModule,
    RbacModule,
    TenantsModule,
    PermissionsModule,
    PlatformModule,
    RolesModule,
    UserRolesModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    ImportExportModule,
    StockModule,
    StoresModule,
    WarehouseModule,
    MovementModule,
    AdjustmentModule,
    SalesModule,
    ReceiptModule,
    PaymentModule,
    NotificationsModule,
    SubscriptionsModule,
    CashRegisterModule,
    PosModule,
    CustomersModule,
    DashboardModule,
    EmailModule,
    ReportsModule,
    SuppliersModule,
    SettingsModule,
    PurchasesModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthenticationMiddleware, TenantContextMiddleware, RbacContextMiddleware).forRoutes("*");
  }
}





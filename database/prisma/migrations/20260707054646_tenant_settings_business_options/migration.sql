-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultTaxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.1,
ADD COLUMN     "invoiceFormat" TEXT NOT NULL DEFAULT 'LETTER',
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
ADD COLUMN     "maxDiscountRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "openCashDrawer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posReceiptFormat" TEXT NOT NULL DEFAULT '80',
ADD COLUMN     "quotePrefix" TEXT NOT NULL DEFAULT 'QUO',
ADD COLUMN     "receiptPrefix" TEXT NOT NULL DEFAULT 'RCT',
ADD COLUMN     "requireCustomer" BOOLEAN NOT NULL DEFAULT false;

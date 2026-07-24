-- Ajoute les relations de cle etrangere manquantes sur StockAlert, PhysicalInventory et HeldSale
-- (aucune des trois n'avait de FK reelle malgre des colonnes tenantId/productId/warehouseId/storeId
-- etc., donc une ligne pouvait pointer vers un tenant/produit/entrepot/magasin deja supprime).
--
-- Chaque ALTER TABLE ... ADD CONSTRAINT est precede d'un nettoyage defensif : les colonnes
-- obligatoires (tenantId, productId sur StockAlert, warehouseId sur PhysicalInventory) suppriment
-- la ligne orpheline (rien d'autre n'est possible, la colonne est NOT NULL) ; les colonnes optionnelles
-- mettent simplement la reference orpheline a NULL. Sans ce nettoyage, la contrainte echouerait des
-- qu'une seule ligne existante pointe vers un parent deja supprime.

-- StockAlert
DELETE FROM "StockAlert" sa WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = sa."tenantId");
DELETE FROM "StockAlert" sa WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = sa."productId");
UPDATE "StockAlert" sa SET "warehouseId" = NULL WHERE sa."warehouseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Warehouse" w WHERE w.id = sa."warehouseId");
UPDATE "StockAlert" sa SET "storeId" = NULL WHERE sa."storeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Store" s WHERE s.id = sa."storeId");

ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PhysicalInventory
DELETE FROM "PhysicalInventory" pi WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = pi."tenantId");
DELETE FROM "PhysicalInventory" pi WHERE NOT EXISTS (SELECT 1 FROM "Warehouse" w WHERE w.id = pi."warehouseId");
UPDATE "PhysicalInventory" pi SET "storeId" = NULL WHERE pi."storeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Store" s WHERE s.id = pi."storeId");

ALTER TABLE "PhysicalInventory" ADD CONSTRAINT "PhysicalInventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhysicalInventory" ADD CONSTRAINT "PhysicalInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhysicalInventory" ADD CONSTRAINT "PhysicalInventory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- HeldSale
DELETE FROM "HeldSale" hs WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = hs."tenantId");
UPDATE "HeldSale" hs SET "customerId" = NULL WHERE hs."customerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Customer" c WHERE c.id = hs."customerId");
UPDATE "HeldSale" hs SET "storeId" = NULL WHERE hs."storeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Store" s WHERE s.id = hs."storeId");
UPDATE "HeldSale" hs SET "warehouseId" = NULL WHERE hs."warehouseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Warehouse" w WHERE w.id = hs."warehouseId");
UPDATE "HeldSale" hs SET "cashSessionId" = NULL WHERE hs."cashSessionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CashSession" cs WHERE cs.id = hs."cashSessionId");

ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HeldSale" ADD CONSTRAINT "HeldSale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

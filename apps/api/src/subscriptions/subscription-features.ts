export const subscriptionFeatureKeys = [
  "POS",
  "PRODUCTS",
  "CATEGORIES",
  "INVENTORY",
  "CUSTOMERS",
  "SUPPLIERS",
  "PURCHASES",
  "SALES_HISTORY",
  "HELD_SALES",
  "BASIC_REPORTS",
  "ADVANCED_REPORTS",
  "USERS",
  "ROLES_PERMISSIONS",
  "EMAIL_RECEIPTS",
  "QUOTES",
  "ORDERS",
  "MULTI_PAYMENT",
  "ADVANCED_TAXES",
  "MULTI_STORE",
  "MULTI_WAREHOUSE",
  "THERMAL_PRINTING",
  "LETTER_REPORT_PRINTING",
  "NOTIFICATIONS",
  "IMPORT_EXPORT",
  "LOW_STOCK_ALERTS",
  "PRINT_SETTINGS",
  "STOCK_TRANSFERS",
  "ADVANCED_AUDIT",
  "ADVANCED_ANALYTICS",
  "MULTI_ACTIVITY",
  "EXPERT_MODE"
] as const;

export type SubscriptionFeatureKey = typeof subscriptionFeatureKeys[number];
export type SubscriptionLimitKey = "users" | "stores" | "warehouses" | "cashRegisters";
export type SubscriptionPlanLimits = Record<SubscriptionLimitKey, number>;

export const defaultPlans = [
  { id: "plan_trial", code: "TRIAL", name: "Essai gratuit", description: "30 jours gratuits avec les fonctionnalites et limites du plan Expert.", monthlyPrice: 0, currency: "HTG", trialDays: 30, sortOrder: 0 },
  { id: "plan_essential", code: "ESSENTIAL", name: "Essentiel", description: "POS, catalogue, inventaire de base, clients, ventes en attente, historique et notifications internes.", monthlyPrice: 1000, currency: "HTG", trialDays: 0, sortOrder: 10 },
  { id: "plan_standard", code: "STANDARD", name: "Professionnel", description: "Achats, fournisseurs, import/export, rapports avances, remises et paiements avances.", monthlyPrice: 2000, currency: "HTG", trialDays: 0, sortOrder: 20 },
  { id: "plan_expert", code: "EXPERT", name: "Expert", description: "Limites etendues, roles avances, audit, analytics, multi-activite et fonctions avancees existantes.", monthlyPrice: 4000, currency: "HTG", trialDays: 0, sortOrder: 30 }
] as const;

export const defaultFeatures: Array<{ id: string; key: SubscriptionFeatureKey; name: string; description: string; category: string }> = [
  { id: "feature_pos", key: "POS", name: "POS", description: "Vente rapide et encaissement.", category: "Ventes" },
  { id: "feature_products", key: "PRODUCTS", name: "Produits", description: "Gestion des produits.", category: "Catalogue" },
  { id: "feature_categories", key: "CATEGORIES", name: "Categories", description: "Gestion des categories.", category: "Catalogue" },
  { id: "feature_inventory", key: "INVENTORY", name: "Inventaire", description: "Stock et mouvements.", category: "Stock" },
  { id: "feature_customers", key: "CUSTOMERS", name: "Clients", description: "Gestion des clients.", category: "CRM" },
  { id: "feature_suppliers", key: "SUPPLIERS", name: "Fournisseurs", description: "Gestion des fournisseurs.", category: "Achats" },
  { id: "feature_purchases", key: "PURCHASES", name: "Achats", description: "Commandes et receptions.", category: "Achats" },
  { id: "feature_sales_history", key: "SALES_HISTORY", name: "Historique des ventes", description: "Consultation des ventes terminees.", category: "Ventes" },
  { id: "feature_held_sales", key: "HELD_SALES", name: "Ventes en attente", description: "Brouillons et ventes en attente.", category: "Ventes" },
  { id: "feature_basic_reports", key: "BASIC_REPORTS", name: "Rapports essentiels", description: "Indicateurs essentiels.", category: "Rapports" },
  { id: "feature_advanced_reports", key: "ADVANCED_REPORTS", name: "Rapports avances", description: "Rapports financiers et analytiques.", category: "Rapports" },
  { id: "feature_users", key: "USERS", name: "Utilisateurs", description: "Gestion des utilisateurs.", category: "Administration" },
  { id: "feature_roles_permissions", key: "ROLES_PERMISSIONS", name: "Roles et permissions", description: "Gestion avancee des acces.", category: "Administration" },
  { id: "feature_email_receipts", key: "EMAIL_RECEIPTS", name: "Recus par email", description: "Envoi de recus et notifications.", category: "Emails" },
  { id: "feature_quotes", key: "QUOTES", name: "Devis", description: "Creation de devis.", category: "Ventes" },
  { id: "feature_orders", key: "ORDERS", name: "Commandes", description: "Creation de commandes.", category: "Ventes" },
  { id: "feature_multi_payment", key: "MULTI_PAYMENT", name: "Paiements avances", description: "Paiements multiples ou avances.", category: "Paiements" },
  { id: "feature_advanced_taxes", key: "ADVANCED_TAXES", name: "Taxes avancees", description: "Gestion avancee des taxes.", category: "Facturation" },
  { id: "feature_multi_store", key: "MULTI_STORE", name: "Multi-magasin", description: "Gestion de plusieurs magasins.", category: "Structure" },
  { id: "feature_multi_warehouse", key: "MULTI_WAREHOUSE", name: "Multi-depot", description: "Gestion de plusieurs depots.", category: "Structure" },
  { id: "feature_thermal_printing", key: "THERMAL_PRINTING", name: "Tickets 58/80 mm", description: "Tickets thermiques 58 mm et 80 mm.", category: "Impression" },
  { id: "feature_letter_report_printing", key: "LETTER_REPORT_PRINTING", name: "Impression Letter/A4", description: "Impression de rapports et documents.", category: "Impression" },
  { id: "feature_notifications", key: "NOTIFICATIONS", name: "Notifications internes", description: "Centre de notifications persistant.", category: "Notifications" },
  { id: "feature_import_export", key: "IMPORT_EXPORT", name: "Import/export CSV/XLSX", description: "Import et export de donnees autorisees.", category: "Donnees" },
  { id: "feature_low_stock_alerts", key: "LOW_STOCK_ALERTS", name: "Alertes stock faible", description: "Alertes de stock faible et rupture.", category: "Stock" },
  { id: "feature_print_settings", key: "PRINT_SETTINGS", name: "Parametres d'impression avances", description: "Formats thermiques, Letter et A4.", category: "Impression" },
  { id: "feature_stock_transfers", key: "STOCK_TRANSFERS", name: "Transferts de stock", description: "Transferts entre depots et magasins.", category: "Stock" },
  { id: "feature_advanced_audit", key: "ADVANCED_AUDIT", name: "Audit avance", description: "Journalisation avancee des actions sensibles.", category: "Administration" },
  { id: "feature_advanced_analytics", key: "ADVANCED_ANALYTICS", name: "Analytics avances", description: "Analyses avancees disponibles dans les rapports.", category: "Rapports" },
  { id: "feature_multi_activity", key: "MULTI_ACTIVITY", name: "Multi-activite", description: "Gestion controlee de plusieurs activites.", category: "Structure" },
  { id: "feature_expert_mode", key: "EXPERT_MODE", name: "Interface complete", description: "Preference d'affichage sans octroi de droits metier.", category: "Interface" }
];

export const planFeatureMatrix: Record<string, SubscriptionFeatureKey[]> = {
  TRIAL: [...subscriptionFeatureKeys],
  EXPERT: [...subscriptionFeatureKeys],
  STANDARD: ["POS", "PRODUCTS", "CATEGORIES", "INVENTORY", "CUSTOMERS", "SUPPLIERS", "PURCHASES", "SALES_HISTORY", "HELD_SALES", "BASIC_REPORTS", "ADVANCED_REPORTS", "USERS", "EMAIL_RECEIPTS", "QUOTES", "ORDERS", "MULTI_PAYMENT", "THERMAL_PRINTING", "LETTER_REPORT_PRINTING", "NOTIFICATIONS", "IMPORT_EXPORT", "LOW_STOCK_ALERTS", "PRINT_SETTINGS"],
  ESSENTIAL: ["POS", "PRODUCTS", "CATEGORIES", "INVENTORY", "CUSTOMERS", "SALES_HISTORY", "HELD_SALES", "BASIC_REPORTS", "THERMAL_PRINTING", "NOTIFICATIONS"]
};

export const planLimitMatrix: Record<string, SubscriptionPlanLimits> = {
  TRIAL: { users: 15, stores: 5, warehouses: 10, cashRegisters: 10 },
  ESSENTIAL: { users: 2, stores: 1, warehouses: 1, cashRegisters: 1 },
  STANDARD: { users: 5, stores: 2, warehouses: 2, cashRegisters: 3 },
  EXPERT: { users: 15, stores: 5, warehouses: 10, cashRegisters: 10 }
};

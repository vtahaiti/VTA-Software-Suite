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
  "EXPERT_MODE"
] as const;

export type SubscriptionFeatureKey = typeof subscriptionFeatureKeys[number];

export const defaultPlans = [
  { id: "plan_trial", code: "TRIAL", name: "Essai gratuit", description: "Essai de 30 jours avec toutes les fonctionnalités activées.", monthlyPrice: 0, currency: "HTG", trialDays: 30, sortOrder: 0 },
  { id: "plan_essential", code: "ESSENTIAL", name: "Essentiel", description: "Fonctionnalités essentielles de VTA Commerce.", monthlyPrice: 1000, currency: "HTG", trialDays: 0, sortOrder: 10 },
  { id: "plan_standard", code: "STANDARD", name: "Standard", description: "Fonctionnalités commerciales avancées.", monthlyPrice: 2000, currency: "HTG", trialDays: 0, sortOrder: 20 },
  { id: "plan_expert", code: "EXPERT", name: "Expert", description: "Toutes les fonctionnalités avancées et le mode expert.", monthlyPrice: 4000, currency: "HTG", trialDays: 0, sortOrder: 30 }
] as const;

export const defaultFeatures: Array<{ id: string; key: SubscriptionFeatureKey; name: string; description: string; category: string }> = [
  { id: "feature_pos", key: "POS", name: "POS", description: "Vente rapide et encaissement.", category: "Ventes" },
  { id: "feature_products", key: "PRODUCTS", name: "Produits", description: "Gestion des produits.", category: "Catalogue" },
  { id: "feature_categories", key: "CATEGORIES", name: "Catégories", description: "Gestion des catégories.", category: "Catalogue" },
  { id: "feature_inventory", key: "INVENTORY", name: "Inventaire", description: "Stock et mouvements.", category: "Stock" },
  { id: "feature_customers", key: "CUSTOMERS", name: "Clients", description: "Gestion des clients.", category: "CRM" },
  { id: "feature_suppliers", key: "SUPPLIERS", name: "Fournisseurs", description: "Gestion des fournisseurs.", category: "Achats" },
  { id: "feature_purchases", key: "PURCHASES", name: "Achats", description: "Commandes et réceptions.", category: "Achats" },
  { id: "feature_sales_history", key: "SALES_HISTORY", name: "Historique des ventes", description: "Consultation des ventes terminées.", category: "Ventes" },
  { id: "feature_held_sales", key: "HELD_SALES", name: "Ventes en attente", description: "Brouillons et ventes en attente.", category: "Ventes" },
  { id: "feature_basic_reports", key: "BASIC_REPORTS", name: "Rapports de base", description: "Indicateurs essentiels.", category: "Rapports" },
  { id: "feature_advanced_reports", key: "ADVANCED_REPORTS", name: "Rapports avancés", description: "Rapports financiers et analytiques.", category: "Rapports" },
  { id: "feature_users", key: "USERS", name: "Utilisateurs", description: "Gestion des utilisateurs.", category: "Administration" },
  { id: "feature_roles_permissions", key: "ROLES_PERMISSIONS", name: "Rôles et permissions", description: "Gestion avancée des accès.", category: "Administration" },
  { id: "feature_email_receipts", key: "EMAIL_RECEIPTS", name: "Reçus par email", description: "Envoi de reçus et notifications.", category: "Emails" },
  { id: "feature_quotes", key: "QUOTES", name: "Devis", description: "Création de devis.", category: "Ventes" },
  { id: "feature_orders", key: "ORDERS", name: "Commandes", description: "Création de commandes.", category: "Ventes" },
  { id: "feature_multi_payment", key: "MULTI_PAYMENT", name: "Paiements multiples", description: "Plusieurs moyens de paiement.", category: "Paiements" },
  { id: "feature_advanced_taxes", key: "ADVANCED_TAXES", name: "Taxes avancées", description: "Gestion avancée des taxes.", category: "Facturation" },
  { id: "feature_multi_store", key: "MULTI_STORE", name: "Multi-magasin", description: "Gestion de plusieurs magasins.", category: "Structure" },
  { id: "feature_multi_warehouse", key: "MULTI_WAREHOUSE", name: "Multi-dépôt", description: "Gestion de plusieurs dépôts.", category: "Structure" },
  { id: "feature_thermal_printing", key: "THERMAL_PRINTING", name: "Impression thermique", description: "Tickets 58 mm et 80 mm.", category: "Impression" },
  { id: "feature_letter_report_printing", key: "LETTER_REPORT_PRINTING", name: "Rapports Letter", description: "Impression de rapports Letter.", category: "Impression" },
  { id: "feature_expert_mode", key: "EXPERT_MODE", name: "Mode expert", description: "Accès au mode expert.", category: "Administration" }
];

export const planFeatureMatrix: Record<string, SubscriptionFeatureKey[]> = {
  TRIAL: [...subscriptionFeatureKeys],
  EXPERT: [...subscriptionFeatureKeys],
  STANDARD: ["POS", "PRODUCTS", "CATEGORIES", "INVENTORY", "CUSTOMERS", "SUPPLIERS", "PURCHASES", "SALES_HISTORY", "HELD_SALES", "BASIC_REPORTS", "ADVANCED_REPORTS", "USERS", "EMAIL_RECEIPTS", "QUOTES", "ORDERS", "MULTI_PAYMENT", "THERMAL_PRINTING", "LETTER_REPORT_PRINTING"],
  ESSENTIAL: ["POS", "PRODUCTS", "CATEGORIES", "INVENTORY", "CUSTOMERS", "SALES_HISTORY", "HELD_SALES", "BASIC_REPORTS", "THERMAL_PRINTING"]
};

export type BusinessModuleDefinition = {
  key: string;
  name: string;
  description: string;
  category: string;
  route?: string;
  icon?: string;
  permissions: string[];
  menuItems: Array<{ label: string; href: string; section: string }>;
  widgets: Array<{ key: string; label: string; description: string }>;
  offlineReady?: boolean;
  isCore?: boolean;
};

export type BusinessProfileDefinition = {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  modules: string[];
};

export type BusinessActivity = {
  name: string;
  profileType: string;
};

export type BusinessCategoryDefinition = {
  key: string;
  name: string;
  description: string;
  activities: BusinessActivity[];
};

export type BusinessActivityTemplate = {
  label: string;
  categoryKey: string;
  profileType: string;
  categories: string[];
};

export type BusinessSpecialty = BusinessActivity & {
  categories: string[];
};

export type BusinessSectorDefinition = {
  key: string;
  name: string;
  description: string;
  specialties: BusinessSpecialty[];
};

export const businessSectors: BusinessSectorDefinition[] = [
  { key: "commerce", name: "Commerce / Market", description: "Boutiques, markets, supermarches et vente generale.", specialties: [
    { name: "Epicerie / Market", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks", "Hygiene", "Detergents"] },
    { name: "Boutique", profileType: "commerce", categories: ["Produits", "Accessoires", "Cadeaux", "Decoration", "Services"] },
    { name: "Supermarche", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks", "Hygiene", "Detergents"] },
    { name: "Vente generale", profileType: "commerce", categories: ["General", "Produits", "Accessoires", "Services"] },
    { name: "Autre commerce", profileType: "commerce", categories: ["General", "Produits", "Services"] }
  ] },
  { key: "restaurant-food", name: "Restaurant / Bar", description: "Restaurant, bar, fast-food, boulangerie et traiteur.", specialties: [
    { name: "Restaurant", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts", "Menus", "Extras"] },
    { name: "Bar", profileType: "restaurant", categories: ["Boissons", "Cocktails", "Snacks", "Extras"] },
    { name: "Fast-food", profileType: "restaurant", categories: ["Menus", "Plats", "Boissons", "Extras"] },
    { name: "Boulangerie / Patisserie", profileType: "restaurant", categories: ["Pains", "Viennoiseries", "Gateaux", "Boissons", "Snacks"] },
    { name: "Traiteur", profileType: "restaurant", categories: ["Menus", "Services", "Plats", "Boissons"] },
    { name: "Autre restauration", profileType: "restaurant", categories: ["Plats", "Boissons", "Services"] }
  ] },
  { key: "hotel", name: "Hotel / Hebergement", description: "Hotels, guest houses, residences et hebergement avec restaurant.", specialties: [
    { name: "Hotel", profileType: "hotel", categories: ["Chambres", "Services", "Restaurant", "Blanchisserie"] },
    { name: "Guest house", profileType: "hotel", categories: ["Chambres", "Services", "Petit dejeuner"] },
    { name: "Appartement / residence", profileType: "hotel", categories: ["Logements", "Services", "Depot"] },
    { name: "Hotel avec restaurant", profileType: "hotel-restaurant", categories: ["Chambres", "Restaurant", "Boissons", "Services"] },
    { name: "Autre hebergement", profileType: "hotel", categories: ["Chambres", "Services"] }
  ] },
  { key: "multi-activities", name: "Services / Multi-activite", description: "Services generaux, imprimerie, reparation, evenementiel et multi-activite.", specialties: [
    { name: "Services generaux", profileType: "services", categories: ["Services", "Forfaits", "Clients"] },
    { name: "Imprimerie / studio", profileType: "printing", categories: ["Impression", "Studio photo", "Design", "Services"] },
    { name: "Reparation", profileType: "it-services", categories: ["Diagnostics", "Reparations", "Pieces", "Services"] },
    { name: "Evenementiel", profileType: "services", categories: ["Services", "Location", "Forfaits", "Clients"] },
    { name: "Multi-activite", profileType: "multi-activities", categories: ["Accessoires / Cadeaux", "Informatique", "Impression", "Studio photo", "Bois / Fabrication", "Services"] },
    { name: "Autre service", profileType: "services", categories: ["Services", "Forfaits", "Clients"] }
  ] },
  { key: "manufacturing", name: "Fabrication / Atelier", description: "Fenetres, portes, menuiserie, ferronnerie, couture et atelier.", specialties: [
    { name: "Fabrication fenêtres/portes", profileType: "windows-aluminium", categories: ["Fenêtres", "Fenetres", "Portes", "Cadres", "Vitrines", "Moustiquaires", "Aluminium", "Bois", "PVC", "Métal", "Metal", "Verre"] },
    { name: "Menuiserie", profileType: "manufacturing", categories: ["Bois", "Planches", "Produits finis", "Services"] },
    { name: "Ferronnerie", profileType: "manufacturing", categories: ["Fer", "Metal", "Produits finis", "Services"] },
    { name: "Couture", profileType: "manufacturing", categories: ["Tissus", "Services", "Produits finis", "Accessoires"] },
    { name: "Atelier de production", profileType: "manufacturing", categories: ["Matieres premieres", "Produits finis", "Services"] },
    { name: "Autre fabrication", profileType: "manufacturing", categories: ["Matieres premieres", "Produits finis", "Services"] }
  ] },
  { key: "construction", name: "Construction / Quincaillerie", description: "Materiaux, quincaillerie, ciment, fer, toles, peinture, plomberie et electricite.", specialties: [
    { name: "Materiaux de construction", profileType: "construction-materials", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Electricite"] },
    { name: "Quincaillerie", profileType: "hardware", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Electricite"] },
    { name: "Ciment / fer / toles", profileType: "construction-materials", categories: ["Ciment", "Fer", "Toles", "Barres", "Accessoires"] },
    { name: "Peinture", profileType: "hardware", categories: ["Peinture", "Diluants", "Pinceaux", "Rouleaux"] },
    { name: "Plomberie / electricite", profileType: "hardware", categories: ["Plomberie", "Electricite", "Tuyaux", "Cables", "Accessoires"] },
    { name: "Autre construction", profileType: "construction-materials", categories: ["Materiaux", "Accessoires", "Services"] }
  ] },
  { key: "health", name: "Sante / Clinique / Pharmacie", description: "Pharmacies, cliniques, cabinets, laboratoires et centres de soins.", specialties: [
    { name: "Pharmacie", profileType: "pharmacy", categories: ["Medicaments", "Vitamines", "Hygiene", "Bebe", "Premiers soins"] },
    { name: "Clinique", profileType: "clinic", categories: ["Consultations", "Examens", "Soins", "Laboratoire"] },
    { name: "Cabinet medical", profileType: "clinic", categories: ["Consultations", "Soins", "Services"] },
    { name: "Laboratoire", profileType: "clinic", categories: ["Examens", "Analyses", "Services"] },
    { name: "Centre de soins", profileType: "clinic", categories: ["Soins", "Consultations", "Services"] },
    { name: "Autre sante", profileType: "clinic", categories: ["Services", "Soins", "Clients"] }
  ] },
  { key: "electronics", name: "Telephone / Electronique", description: "Vente et reparation telephones, informatique et electronique.", specialties: [
    { name: "Vente telephones", profileType: "commerce", categories: ["Telephones", "Accessoires", "Chargeurs", "Ecouteurs"] },
    { name: "Accessoires telephones", profileType: "commerce", categories: ["Coques", "Chargeurs", "Ecouteurs", "Cables"] },
    { name: "Reparation telephones", profileType: "it-services", categories: ["Reparations", "Pieces", "Diagnostics", "Services"] },
    { name: "Informatique", profileType: "it-services", categories: ["Services IT", "Ordinateurs", "Reseaux", "Logiciels", "Accessoires"] },
    { name: "Electronique generale", profileType: "commerce", categories: ["Electronique", "Accessoires", "Pieces", "Services"] },
    { name: "Autre electronique", profileType: "commerce", categories: ["Electronique", "Accessoires", "Services"] }
  ] },
  { key: "education", name: "Education / Ecole", description: "Ecoles, centres de formation, cours particuliers et garderies.", specialties: [
    { name: "Ecole", profileType: "school", categories: ["Frais scolaires", "Uniformes", "Livres", "Services", "Transport"] },
    { name: "Centre de formation", profileType: "school", categories: ["Formations", "Frais", "Supports", "Services"] },
    { name: "Cours particuliers", profileType: "school", categories: ["Cours", "Forfaits", "Services"] },
    { name: "Garderie", profileType: "school", categories: ["Frais", "Repas", "Services"] },
    { name: "Autre education", profileType: "school", categories: ["Services", "Frais", "Supports"] }
  ] },
  { key: "fashion-beauty", name: "Beaute / Salon", description: "Salon, barber shop, spa et cosmetique.", specialties: [
    { name: "Salon de beaute", profileType: "services", categories: ["Coiffure", "Soins", "Services", "Produits"] },
    { name: "Barber shop", profileType: "services", categories: ["Coupe", "Barbe", "Services", "Produits"] },
    { name: "Spa", profileType: "services", categories: ["Massages", "Soins", "Forfaits", "Produits"] },
    { name: "Cosmetique", profileType: "fashion", categories: ["Maquillage", "Soins visage", "Soins cheveux", "Parfums", "Accessoires"] },
    { name: "Autre beaute", profileType: "services", categories: ["Services", "Produits", "Forfaits"] }
  ] },
  { key: "transport-distribution", name: "Transport / Location", description: "Transport, location vehicules, livraison et logistique.", specialties: [
    { name: "Transport", profileType: "services", categories: ["Transport", "Services", "Forfaits"] },
    { name: "Location vehicules", profileType: "services", categories: ["Vehicules", "Location", "Services"] },
    { name: "Livraison", profileType: "services", categories: ["Livraisons", "Forfaits", "Services"] },
    { name: "Logistique", profileType: "services", categories: ["Logistique", "Services", "Forfaits"] },
    { name: "Autre transport", profileType: "services", categories: ["Services", "Transport", "Forfaits"] }
  ] },
  { key: "other", name: "Autre activite", description: "Activite non listee, avec socle commerce/services.", specialties: [
    { name: "Autre activite", profileType: "commerce", categories: ["General", "Produits", "Services"] }
  ] }
];
export const businessActivityTemplates: BusinessActivityTemplate[] = businessSectors.flatMap((sector) =>
  sector.specialties.map((specialty) => ({
    label: specialty.name,
    categoryKey: sector.key,
    profileType: specialty.profileType,
    categories: specialty.categories
  }))
);

export function activityLabelWithoutIcon(label: string) {
  return label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function findActivityTemplate(activityName?: string) {
  const normalized = activityName?.trim();
  return businessActivityTemplates.find((template) => template.label === normalized || activityLabelWithoutIcon(template.label) === normalized) ?? businessActivityTemplates[0];
}

export const businessCategories: BusinessCategoryDefinition[] = businessSectors.map((sector) => ({
  key: sector.key,
  name: sector.name,
  description: sector.description,
  activities: sector.specialties.map(({ name, profileType }) => ({ name, profileType }))
}));

export function resolveBusinessProfileSlug(categoryKey?: string, activityName?: string) {
  const template = findActivityTemplate(activityName);
  if (template) return template.profileType;
  const category = businessCategories.find((item) => item.key === categoryKey) ?? businessCategories[0];
  const activity = category.activities.find((item) => item.name === activityName) ?? category.activities[0];
  return activity.profileType || "commerce";
}

export const businessModules: BusinessModuleDefinition[] = [
  { key: "dashboard", name: "Accueil", description: "Vue simple de l'entreprise", category: "GÃ©nÃ©ral", route: "/dashboard", icon: "home", permissions: ["dashboard.view"], isCore: true, menuItems: [{ label: "Accueil", href: "/dashboard", section: "Principal" }], widgets: [{ key: "overview", label: "SynthÃ¨se", description: "Indicateurs essentiels" }] },
  { key: "pos", name: "Nouvelle vente", description: "Vente rapide, caisse et tickets", category: "Vente", route: "/dashboard/pos", icon: "pos", permissions: ["pos.sell"], menuItems: [{ label: "Nouvelle vente", href: "/dashboard/pos", section: "Principal" }, { label: "Historique POS", href: "/dashboard/pos/history", section: "Ventes" }, { label: "Sessions caisse", href: "/dashboard/pos/sessions", section: "ParamÃ¨tres" }, { label: "Caisses", href: "/dashboard/cash-registers", section: "ParamÃ¨tres" }], widgets: [{ key: "sales-today", label: "Ventes du jour", description: "Ventes POS aujourd'hui" }] },
  { key: "products", name: "Produits", description: "Catalogue produits et variantes", category: "Catalogue", route: "/dashboard/products", icon: "box", permissions: ["products.view"], menuItems: [{ label: "Produits", href: "/dashboard/products", section: "Produits" }, { label: "CatÃ©gories", href: "/dashboard/products/categories", section: "Produits" }, { label: "Marques", href: "/dashboard/products/brands", section: "Produits" }, { label: "UnitÃ©s", href: "/dashboard/products/units", section: "Produits" }], widgets: [{ key: "products", label: "Produits", description: "Produits actifs" }] },
  { key: "inventory", name: "Stock", description: "Stock, mouvements, alertes et transferts", category: "Stock", route: "/dashboard/inventory", icon: "warehouse", permissions: ["inventory.view"], menuItems: [{ label: "Stock", href: "/dashboard/inventory", section: "Stock" }, { label: "Mouvements", href: "/dashboard/inventory/movements", section: "Stock" }, { label: "Ajustements", href: "/dashboard/inventory/adjustments", section: "Stock" }, { label: "Transferts", href: "/dashboard/transfers", section: "Stock" }, { label: "Magasins", href: "/dashboard/stores", section: "Stock" }, { label: "EntrepÃ´ts", href: "/dashboard/warehouses", section: "Stock" }], widgets: [{ key: "low-stock", label: "Stock faible", description: "Produits sous seuil" }, { key: "stock-by-store", label: "Stock par magasin", description: "Stock rÃ©parti par point de vente" }] },
  { key: "customers", name: "Clients", description: "CRM, soldes et historique", category: "Commercial", route: "/dashboard/customers", icon: "users", permissions: ["customer.read"], menuItems: [{ label: "Clients", href: "/dashboard/customers", section: "Principal" }], widgets: [{ key: "customers", label: "Clients", description: "Clients actifs" }] },
  { key: "suppliers", name: "Achats", description: "Fournisseurs, achats et rÃ©ceptions", category: "Commercial", route: "/dashboard/purchases", icon: "truck", permissions: ["suppliers.view"], menuItems: [{ label: "Fournisseurs", href: "/dashboard/suppliers", section: "Achats" }, { label: "Achats", href: "/dashboard/purchases", section: "Achats" }, { label: "RÃ©ceptions", href: "/dashboard/purchases/receipts", section: "Achats" }, { label: "Factures fournisseurs", href: "/dashboard/purchases/invoices", section: "Achats" }, { label: "Paiements fournisseurs", href: "/dashboard/purchases/payments", section: "Achats" }], widgets: [{ key: "pending-purchases", label: "Achats en attente", description: "Commandes fournisseurs ouvertes" }] },
  { key: "sales", name: "Ventes", description: "Devis, commandes, acomptes, factures, paiements et retours", category: "Ventes", route: "/dashboard/sales", icon: "receipt", permissions: ["sales.read"], menuItems: [{ label: "Devis & Commandes", href: "/dashboard/sales", section: "Principal" }, { label: "Devis", href: "/dashboard/sales/quotes", section: "Ventes" }, { label: "Commandes & Acomptes", href: "/dashboard/sales/proformas", section: "Ventes" }, { label: "Factures", href: "/dashboard/sales/invoices", section: "Ventes" }, { label: "Retours", href: "/dashboard/sales/returns", section: "Ventes" }, { label: "Paiements", href: "/dashboard/payments", section: "Ventes" }], widgets: [{ key: "invoices", label: "Factures", description: "Documents de vente" }] },
  { key: "reports", name: "Rapports", description: "Rapports business et exports", category: "Administration", route: "/dashboard/reports", icon: "chart", permissions: ["reports.read"], menuItems: [{ label: "Rapports", href: "/dashboard/reports", section: "Principal" }, { label: "Import / Export", href: "/dashboard/import-export", section: "ParamÃ¨tres" }], widgets: [{ key: "revenue", label: "Chiffre d'affaires", description: "Performance commerciale" }] },
  { key: "settings", name: "ParamÃ¨tres", description: "Configuration entreprise et sÃ©curitÃ©", category: "Administration", route: "/dashboard/settings/company", icon: "settings", permissions: ["settings.read"], menuItems: [{ label: "ParamÃ¨tres", href: "/dashboard/settings/company", section: "Principal" }, { label: "Entreprise", href: "/dashboard/settings/company", section: "ParamÃ¨tres" }, { label: "Profil", href: "/profile", section: "ParamÃ¨tres" }, { label: "Utilisateurs", href: "/dashboard/settings/roles", section: "ParamÃ¨tres" }, { label: "RÃ´les", href: "/dashboard/settings/roles", section: "ParamÃ¨tres" }, { label: "Permissions", href: "/dashboard/settings/permissions", section: "ParamÃ¨tres" }, { label: "ParamÃ¨tres POS", href: "/dashboard/settings/pos", section: "ParamÃ¨tres" }, { label: "Facturation", href: "/dashboard/settings/invoicing", section: "ParamÃ¨tres" }, { label: "SÃ©curitÃ©", href: "/dashboard/security", section: "ParamÃ¨tres" }, { label: "Sauvegardes", href: "/dashboard/backups", section: "ParamÃ¨tres" }, { label: "Audit", href: "/dashboard/audit", section: "ParamÃ¨tres" }, { label: "Business Modules", href: "/dashboard/settings/business-modules", section: "ParamÃ¨tres" }], widgets: [] },
  { key: "fashion", name: "Mode", description: "Tailles, couleurs et collections", category: "SpÃ©cialisÃ©", icon: "shirt", permissions: ["products.view"], menuItems: [{ label: "Tailles et couleurs", href: "/dashboard/products", section: "Produits" }], widgets: [{ key: "fashion-variants", label: "Tailles et couleurs", description: "Variantes vÃªtements" }] },
  { key: "pharmacy", name: "Pharmacie", description: "Lots, expiration et ordonnances prÃ©parÃ©es", category: "SpÃ©cialisÃ©", icon: "pill", permissions: ["products.view", "inventory.view"], menuItems: [{ label: "Lots et expirations", href: "/dashboard/inventory", section: "Stock" }], widgets: [{ key: "expiring-products", label: "Produits bientÃ´t expirÃ©s", description: "Surveillance pharmacie" }] },
  { key: "measurements", name: "Mesures", description: "Longueur, poids, largeur, hauteur", category: "SpÃ©cialisÃ©", icon: "ruler", permissions: ["products.view"], menuItems: [{ label: "Mesures", href: "/dashboard/products", section: "Produits" }], widgets: [{ key: "measurements", label: "Mesures", description: "Produits vendus par mesure" }] },
  { key: "restaurant", name: "Restaurant", description: "Restaurant V1 avec POS, menu, ventes en attente, historique et tickets", category: "SpÃ©cialisÃ©", icon: "utensils", permissions: ["pos.sell"], menuItems: [{ label: "POS / Nouvelle vente", href: "/dashboard/pos", section: "Restaurant" }, { label: "Produits / menu", href: "/dashboard/products", section: "Restaurant" }, { label: "Ventes en attente", href: "/dashboard/sales/in-progress", section: "Restaurant" }, { label: "Historique", href: "/dashboard/sales/completed", section: "Restaurant" }], widgets: [{ key: "restaurant-pos", label: "POS restaurant", description: "Prise de commande et ticket" }, { key: "restaurant-menu", label: "Produits / menu", description: "Plats, boissons et menus" }] },
  { key: "hotel", name: "HÃ´tel", description: "RÃ©servations, chambres et services", category: "SpÃ©cialisÃ©", icon: "hotel", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "RÃ©servations", href: "/dashboard/customers", section: "HÃ´tel" }, { label: "Chambres", href: "/dashboard/stores", section: "HÃ´tel" }], widgets: [{ key: "rooms", label: "Chambres", description: "Occupation prÃ©parÃ©e" }] },
  { key: "school", name: "Ã‰ducation", description: "Ã‰lÃ¨ves, paiements et services scolaires", category: "SpÃ©cialisÃ©", icon: "school", permissions: ["customer.read", "payment.read"], menuItems: [{ label: "Ã‰lÃ¨ves", href: "/dashboard/customers", section: "Ã‰ducation" }, { label: "Paiements scolaires", href: "/dashboard/payments", section: "Ã‰ducation" }], widgets: [{ key: "students", label: "Ã‰lÃ¨ves", description: "Gestion scolaire prÃ©parÃ©e" }] },
  { key: "printing", name: "Impression", description: "Production, DTF, broderie et laser", category: "SpÃ©cialisÃ©", icon: "printer", permissions: ["sales.read"], menuItems: [{ label: "Production", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "DTF", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "Laser", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "Broderie", href: "/dashboard/sales/quotes", section: "Impression" }], widgets: [{ key: "production", label: "Production", description: "Commandes en production" }] },
  { key: "garage", name: "Automobile", description: "VÃ©hicules, rÃ©parations et rendez-vous", category: "SpÃ©cialisÃ©", icon: "car", permissions: ["customer.read", "products.view", "invoice.read"], menuItems: [{ label: "VÃ©hicules", href: "/dashboard/customers", section: "Automobile" }, { label: "RÃ©parations", href: "/dashboard/sales/invoices", section: "Automobile" }, { label: "Rendez-vous", href: "/dashboard/customers", section: "Automobile" }], widgets: [{ key: "repairs", label: "RÃ©parations", description: "RÃ©parations en cours" }, { key: "appointments", label: "Rendez-vous", description: "Planning garage" }] },
  { key: "services", name: "Services", description: "Services professionnels", category: "SpÃ©cialisÃ©", icon: "service", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Services", href: "/dashboard/sales/invoices", section: "Services" }], widgets: [{ key: "services", label: "Services", description: "Services actifs" }] },
  { key: "it-services", name: "Services informatiques", description: "Services IT et clients", category: "SpÃ©cialisÃ©", icon: "computer", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Services IT", href: "/dashboard/sales/invoices", section: "Services" }], widgets: [{ key: "it-services", label: "Services informatiques", description: "Services IT actifs" }] }
];

export const businessProfiles: BusinessProfileDefinition[] = [
  { slug: "commerce", name: "Commerce", description: "ModÃ¨le simple pour boutiques, markets et grossistes.", category: "Commerce", icon: "store", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "reports", "settings"] },
  { slug: "fashion", name: "Mode & BeautÃ©", description: "Commerce avec tailles, couleurs et collections.", category: "Mode & BeautÃ©", icon: "shirt", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "reports", "settings", "fashion"] },
  { slug: "restaurant", name: "Restaurant", description: "POS, menu, ventes en attente, historique et tickets.", category: "Restaurant & Alimentation", icon: "utensils", modules: ["dashboard", "pos", "products", "customers", "reports", "settings", "restaurant"] },
  { slug: "hotel", name: "HÃ´tel", description: "HÃ©bergement, clients, facturation et services.", category: "HÃ´tel & HÃ©bergement", icon: "hotel", modules: ["dashboard", "pos", "customers", "reports", "settings", "hotel"] },
  { slug: "hotel-restaurant", name: "Hotel avec restaurant", description: "Hebergement avec POS restaurant, produits/menu, stock simple et facturation.", category: "Hotel / Hebergement", icon: "hotel", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "reports", "settings", "hotel", "restaurant"] },
  { slug: "pharmacy", name: "Pharmacie", description: "Commerce avec lots et expirations.", category: "SantÃ©", icon: "pill", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "reports", "settings", "pharmacy"] },
  { slug: "clinic", name: "Clinique", description: "Patients, services et facturation.", category: "SantÃ©", icon: "clinic", modules: ["dashboard", "pos", "customers", "reports", "settings", "pharmacy"] },
  { slug: "school", name: "Ã‰ducation", description: "Ã‰lÃ¨ves, paiements et facturation.", category: "Ã‰ducation", icon: "school", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "school"] },
  { slug: "hardware", name: "Quincaillerie", description: "Commerce avec mesures et stock.", category: "Construction", icon: "tool", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "construction-materials", name: "MatÃ©riaux", description: "MatÃ©riaux de construction et stock lourd.", category: "Construction", icon: "bricks", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "windows-aluminium", name: "Fabrication fenÃªtres/portes", description: "FenÃªtres, portes, cadres, vitrines, moustiquaires, devis avec mesures, acomptes et installation simple.", category: "Construction", icon: "window", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "garage", name: "Automobile", description: "VÃ©hicules, rÃ©parations et piÃ¨ces.", category: "Automobile", icon: "car", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "garage"] },
  { slug: "manufacturing", name: "Fabrication", description: "Ateliers et production artisanale.", category: "Fabrication", icon: "factory", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "printing", name: "Impression", description: "Production, DTF, broderie et communication.", category: "Impression & Communication", icon: "printer", modules: ["dashboard", "pos", "products", "customers", "suppliers", "sales", "reports", "settings", "printing"] },
  { slug: "services", name: "Services", description: "Services professionnels et facturation.", category: "Services", icon: "service", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "services"] },
  { slug: "it-services", name: "Services informatiques", description: "Services IT et clients.", category: "Services", icon: "computer", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "it-services"] },
  { slug: "multi-activities", name: "Multi-activitÃ© / Commerce & Services", description: "Commerce, services informatiques, impression, studio photo, fabrication lÃ©gÃ¨re et commandes avec acomptes dans un mÃªme tenant.", category: "Multi-activitÃ© / Commerce & Services", icon: "layers", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "printing", "services", "it-services", "measurements"] }
];

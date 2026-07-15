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

export const businessActivityTemplates: BusinessActivityTemplate[] = [
  { label: "Commerce / Market", categoryKey: "commerce", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks", "Hygiène", "Détergents"] },
  { label: "Boutique de vêtements", categoryKey: "fashion-beauty", profileType: "fashion", categories: ["T-shirts", "Jeans", "Robes", "Chaussures", "Casquettes", "Accessoires"] },
  { label: "Supermarché", categoryKey: "commerce", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks", "Hygiène", "Détergents"] },
  { label: "Restaurant", categoryKey: "restaurant-food", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts", "Menus", "Extras"] },
  { label: "Bar / Café", categoryKey: "restaurant-food", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts", "Menus", "Extras"] },
  { label: "Hôtel", categoryKey: "hotel", profileType: "hotel", categories: ["Chambres", "Services", "Restaurant", "Blanchisserie", "Parking"] },
  { label: "Pharmacie", categoryKey: "health", profileType: "pharmacy", categories: ["Médicaments", "Vitamines", "Hygiène", "Bébé", "Premiers soins"] },
  { label: "Clinique", categoryKey: "health", profileType: "clinic", categories: ["Consultations", "Examens", "Medicaments", "Soins", "Laboratoire"] },
  { label: "École", categoryKey: "education", profileType: "school", categories: ["Écolage", "Uniformes", "Livres", "Frais inscription", "Transport"] },
  { label: "Fabrication", categoryKey: "manufacturing", profileType: "manufacturing", categories: ["Aluminium", "Vitres", "Portes", "Accessoires", "Matières premières", "Produits finis"] },
  { label: "Fabrication fenêtres/portes", categoryKey: "construction", profileType: "windows-aluminium", categories: ["Fenêtres", "Portes", "Cadres", "Vitrines", "Moustiquaires", "Aluminium", "Bois", "PVC", "Métal", "Verre", "Accessoires"] },
  { label: "Portes / Fenêtres / Aluminium", categoryKey: "construction", profileType: "windows-aluminium", categories: ["Aluminium", "Vitres", "Portes", "Accessoires", "Matières premières", "Produits finis"] },
  { label: "Matériaux de construction", categoryKey: "construction", profileType: "construction-materials", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Électricité"] },
  { label: "Quincaillerie", categoryKey: "construction", profileType: "hardware", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Électricité"] },
  { label: "Garage", categoryKey: "automotive", profileType: "garage", categories: ["Pièces", "Services", "Lubrifiants", "Pneus", "Diagnostic"] },
  { label: "Téléphones & Électronique", categoryKey: "commerce", profileType: "commerce", categories: ["Téléphones", "Accessoires", "Chargeurs", "Ecouteurs", "Ordinateurs", "Pieces"] },
  { label: "Informatique", categoryKey: "services", profileType: "it-services", categories: ["Services IT", "Ordinateurs", "Reseaux", "Logiciels", "Accessoires"] },
  { label: "Imprimerie / Publicité", categoryKey: "printing-communication", profileType: "printing", categories: ["DTF", "Broderie", "Sérigraphie", "Sublimation", "Laser"] },
  { label: "Cadeaux / Souvenirs", categoryKey: "commerce", profileType: "commerce", categories: ["Cadeaux", "Souvenirs", "Decoration", "Cartes", "Accessoires"] },
  { label: "Meubles", categoryKey: "commerce", profileType: "commerce", categories: ["Chaises", "Tables", "Lits", "Armoires", "Canapes", "Decoration"] },
  { label: "Chaussures", categoryKey: "fashion-beauty", profileType: "fashion", categories: ["Hommes", "Femmes", "Enfants", "Sandales", "Baskets", "Accessoires"] },
  { label: "Cosmétique", categoryKey: "fashion-beauty", profileType: "commerce", categories: ["Maquillage", "Soins visage", "Soins cheveux", "Parfums", "Hygiène", "Accessoires"] },
  { label: "Boucherie", categoryKey: "restaurant-food", profileType: "commerce", categories: ["Boeuf", "Porc", "Poulet", "Charcuterie", "Congelés"] },
  { label: "Poissonnerie", categoryKey: "restaurant-food", profileType: "commerce", categories: ["Poissons", "Fruits de mer", "Congelés", "Épices", "Préparations"] },
  { label: "Boulangerie", categoryKey: "restaurant-food", profileType: "commerce", categories: ["Pains", "Viennoiseries", "Gâteaux", "Boissons", "Snacks"] },
  { label: "Agriculture", categoryKey: "agriculture", profileType: "commerce", categories: ["Semences", "Engrais", "Outils", "Récoltes", "Aliments bétail"] },
  { label: "Elevage", categoryKey: "agriculture", profileType: "commerce", categories: ["Poulets", "Betail", "Aliments", "Medicaments", "Equipements"] },
  { label: "Distribution", categoryKey: "transport-distribution", profileType: "commerce", categories: ["Produits distribués", "Livraisons", "Emballages", "Retours", "Services"] },
  { label: "Multi-activité / Commerce & Services", categoryKey: "multi-activities", profileType: "multi-activities", categories: ["Accessoires / Cadeaux", "Informatique", "Impression", "Studio photo", "Bois / Fabrication", "Services"] },
  { label: "Autre", categoryKey: "other", profileType: "commerce", categories: ["Général", "Produits", "Services"] }
];

export function activityLabelWithoutIcon(label: string) {
  return label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function findActivityTemplate(activityName?: string) {
  const normalized = activityName?.trim();
  return businessActivityTemplates.find((template) => template.label === normalized || activityLabelWithoutIcon(template.label) === normalized) ?? businessActivityTemplates[0];
}

export const businessCategories: BusinessCategoryDefinition[] = [
  { key: "commerce", name: "Commerce", description: "Boutiques, markets, supermarchés et grossistes.", activities: [
    { name: "Boutique / Market", profileType: "commerce" }, { name: "Supermarché", profileType: "commerce" }, { name: "Dépôt de boissons", profileType: "commerce" }, { name: "Grossiste", profileType: "commerce" }, { name: "Librairie", profileType: "commerce" }, { name: "Électronique", profileType: "commerce" }, { name: "Téléphones & Accessoires", profileType: "commerce" }
  ] },
  { key: "fashion-beauty", name: "Mode & Beauté", description: "Vêtements, chaussures, cosmétique et salons.", activities: [
    { name: "Boutique vêtements", profileType: "fashion" }, { name: "Chaussures", profileType: "fashion" }, { name: "Bijouterie", profileType: "commerce" }, { name: "Cosmétique", profileType: "commerce" }, { name: "Salon de beauté", profileType: "services" }, { name: "Barber shop", profileType: "services" }
  ] },
  { key: "restaurant-food", name: "Restaurant & Alimentation", description: "Restaurant, bar, boulangerie et alimentation préparée.", activities: [
    { name: "Restaurant", profileType: "restaurant" }, { name: "Fast-food", profileType: "restaurant" }, { name: "Bar", profileType: "restaurant" }, { name: "Boulangerie", profileType: "commerce" }, { name: "Patisserie", profileType: "commerce" }, { name: "Glacier", profileType: "commerce" }
  ] },
  { key: "hotel", name: "Hôtel & Hébergement", description: "Hôtels, maisons d'hôtes et auberges.", activities: [
    { name: "Hôtel", profileType: "hotel" }, { name: "Maison d'hôtes", profileType: "hotel" }, { name: "Auberge", profileType: "hotel" }
  ] },
  { key: "health", name: "Santé", description: "Pharmacies, cliniques et cabinets médicaux.", activities: [
    { name: "Pharmacie", profileType: "pharmacy" }, { name: "Clinique", profileType: "clinic" }, { name: "Cabinet medical", profileType: "clinic" }, { name: "Laboratoire", profileType: "clinic" }
  ] },
  { key: "education", name: "Éducation", description: "Écoles, universités et centres de formation.", activities: [
    { name: "École", profileType: "school" }, { name: "Université", profileType: "school" }, { name: "Centre de formation", profileType: "school" }, { name: "Crèche", profileType: "school" }
  ] },
  { key: "construction", name: "Construction", description: "Quincaillerie, matériaux, électricité et ateliers.", activities: [
    { name: "Quincaillerie", profileType: "hardware" }, { name: "Matériaux de construction", profileType: "construction-materials" }, { name: "Fabrication fenêtres/portes", profileType: "windows-aluminium" }, { name: "Électricité", profileType: "commerce" }, { name: "Plomberie", profileType: "commerce" }, { name: "Aluminium / Vitrerie", profileType: "windows-aluminium" }, { name: "Menuiserie", profileType: "manufacturing" }, { name: "Ferronnerie", profileType: "manufacturing" }
  ] },
  { key: "automotive", name: "Automobile", description: "Garage, pièces auto, car wash et location.", activities: [
    { name: "Garage", profileType: "garage" }, { name: "Vente de pièces auto", profileType: "garage" }, { name: "Car Wash", profileType: "garage" }, { name: "Location de véhicules", profileType: "services" }
  ] },
  { key: "manufacturing", name: "Fabrication", description: "Ateliers, soudure et production artisanale.", activities: [
    { name: "Fabrication fenêtres/portes", profileType: "windows-aluminium" }, { name: "Atelier aluminium", profileType: "windows-aluminium" }, { name: "Menuiserie bois", profileType: "manufacturing" }, { name: "Ferronnerie", profileType: "manufacturing" }, { name: "Soudure", profileType: "manufacturing" }, { name: "Production artisanale", profileType: "manufacturing" }
  ] },
  { key: "printing-communication", name: "Impression & Communication", description: "Imprimerie, DTF, broderie, pub et studio photo.", activities: [
    { name: "Imprimerie", profileType: "printing" }, { name: "Serigraphie", profileType: "printing" }, { name: "Broderie", profileType: "printing" }, { name: "DTF", profileType: "printing" }, { name: "Sublimation", profileType: "printing" }, { name: "Agence publicite", profileType: "printing" }, { name: "Studio photo", profileType: "services" }
  ] },
  { key: "services", name: "Services", description: "Services professionnels et informatiques.", activities: [
    { name: "Cabinet comptable", profileType: "services" }, { name: "Cabinet d'avocats", profileType: "services" }, { name: "Agence immobilière", profileType: "services" }, { name: "Agence de voyage", profileType: "services" }, { name: "Entreprise sécurité", profileType: "services" }, { name: "Cybercafé", profileType: "it-services" }, { name: "Services informatiques", profileType: "it-services" }
  ] },
  { key: "agriculture", name: "Agriculture", description: "Agro-business, ferme et élevage.", activities: [
    { name: "Agro-business", profileType: "commerce" }, { name: "Ferme", profileType: "commerce" }, { name: "Elevage", profileType: "commerce" }
  ] },
  { key: "transport-distribution", name: "Transport & Distribution", description: "Transport, livraison et distribution.", activities: [
    { name: "Distribution", profileType: "commerce" }, { name: "Transport", profileType: "services" }, { name: "Messagerie", profileType: "services" }, { name: "Livraison", profileType: "services" }
  ] },
  { key: "organizations", name: "Organisations", description: "ONG, églises, associations et coopératives.", activities: [
    { name: "ONG", profileType: "services" }, { name: "Eglise", profileType: "services" }, { name: "Association", profileType: "services" }, { name: "Cooperative", profileType: "commerce" }
  ] },
  { key: "multi-activities", name: "Multi-activité / Commerce & Services", description: "Commerce, services, impression, studio photo et fabrication légère dans un même tenant.", activities: [
    { name: "Multi-activité / Commerce & Services", profileType: "multi-activities" }, { name: "Entreprise multi-services", profileType: "multi-activities" }, { name: "Commerce & services", profileType: "multi-activities" }, { name: "Autre multi-activités", profileType: "multi-activities" }
  ] },
  { key: "other", name: "Autre", description: "Activité non listée.", activities: [{ name: "Autre activité", profileType: "commerce" }] }
];

export function resolveBusinessProfileSlug(categoryKey?: string, activityName?: string) {
  const template = findActivityTemplate(activityName);
  if (template) return template.profileType;
  const category = businessCategories.find((item) => item.key === categoryKey) ?? businessCategories[0];
  const activity = category.activities.find((item) => item.name === activityName) ?? category.activities[0];
  return activity.profileType || "commerce";
}

export const businessModules: BusinessModuleDefinition[] = [
  { key: "dashboard", name: "Accueil", description: "Vue simple de l'entreprise", category: "Général", route: "/dashboard", icon: "home", permissions: ["dashboard.view"], isCore: true, menuItems: [{ label: "Accueil", href: "/dashboard", section: "Principal" }], widgets: [{ key: "overview", label: "Synthèse", description: "Indicateurs essentiels" }] },
  { key: "pos", name: "Nouvelle vente", description: "Vente rapide, caisse et tickets", category: "Vente", route: "/dashboard/pos", icon: "pos", permissions: ["pos.sell"], menuItems: [{ label: "Nouvelle vente", href: "/dashboard/pos", section: "Principal" }, { label: "Historique POS", href: "/dashboard/pos/history", section: "Ventes" }, { label: "Sessions caisse", href: "/dashboard/pos/sessions", section: "Paramètres" }, { label: "Caisses", href: "/dashboard/cash-registers", section: "Paramètres" }], widgets: [{ key: "sales-today", label: "Ventes du jour", description: "Ventes POS aujourd'hui" }] },
  { key: "products", name: "Produits", description: "Catalogue produits et variantes", category: "Catalogue", route: "/dashboard/products", icon: "box", permissions: ["products.view"], menuItems: [{ label: "Produits", href: "/dashboard/products", section: "Produits" }, { label: "Catégories", href: "/dashboard/products/categories", section: "Produits" }, { label: "Marques", href: "/dashboard/products/brands", section: "Produits" }, { label: "Unités", href: "/dashboard/products/units", section: "Produits" }], widgets: [{ key: "products", label: "Produits", description: "Produits actifs" }] },
  { key: "inventory", name: "Stock", description: "Stock, mouvements, alertes et transferts", category: "Stock", route: "/dashboard/inventory", icon: "warehouse", permissions: ["inventory.view"], menuItems: [{ label: "Stock", href: "/dashboard/inventory", section: "Stock" }, { label: "Mouvements", href: "/dashboard/inventory/movements", section: "Stock" }, { label: "Ajustements", href: "/dashboard/inventory/adjustments", section: "Stock" }, { label: "Transferts", href: "/dashboard/transfers", section: "Stock" }, { label: "Magasins", href: "/dashboard/stores", section: "Stock" }, { label: "Entrepôts", href: "/dashboard/warehouses", section: "Stock" }], widgets: [{ key: "low-stock", label: "Stock faible", description: "Produits sous seuil" }, { key: "stock-by-store", label: "Stock par magasin", description: "Stock réparti par point de vente" }] },
  { key: "customers", name: "Clients", description: "CRM, soldes et historique", category: "Commercial", route: "/dashboard/customers", icon: "users", permissions: ["customer.read"], menuItems: [{ label: "Clients", href: "/dashboard/customers", section: "Principal" }], widgets: [{ key: "customers", label: "Clients", description: "Clients actifs" }] },
  { key: "suppliers", name: "Achats", description: "Fournisseurs, achats et réceptions", category: "Commercial", route: "/dashboard/purchases", icon: "truck", permissions: ["suppliers.view"], menuItems: [{ label: "Fournisseurs", href: "/dashboard/suppliers", section: "Achats" }, { label: "Achats", href: "/dashboard/purchases", section: "Achats" }, { label: "Réceptions", href: "/dashboard/purchases/receipts", section: "Achats" }, { label: "Factures fournisseurs", href: "/dashboard/purchases/invoices", section: "Achats" }, { label: "Paiements fournisseurs", href: "/dashboard/purchases/payments", section: "Achats" }], widgets: [{ key: "pending-purchases", label: "Achats en attente", description: "Commandes fournisseurs ouvertes" }] },
  { key: "sales", name: "Ventes", description: "Devis, commandes, acomptes, factures, paiements et retours", category: "Ventes", route: "/dashboard/sales", icon: "receipt", permissions: ["sales.read"], menuItems: [{ label: "Devis & Commandes", href: "/dashboard/sales", section: "Principal" }, { label: "Devis", href: "/dashboard/sales/quotes", section: "Ventes" }, { label: "Commandes & Acomptes", href: "/dashboard/sales/proformas", section: "Ventes" }, { label: "Factures", href: "/dashboard/sales/invoices", section: "Ventes" }, { label: "Retours", href: "/dashboard/sales/returns", section: "Ventes" }, { label: "Paiements", href: "/dashboard/payments", section: "Ventes" }], widgets: [{ key: "invoices", label: "Factures", description: "Documents de vente" }] },
  { key: "reports", name: "Rapports", description: "Rapports business et exports", category: "Administration", route: "/dashboard/reports", icon: "chart", permissions: ["reports.read"], menuItems: [{ label: "Rapports", href: "/dashboard/reports", section: "Principal" }, { label: "Import / Export", href: "/dashboard/import-export", section: "Paramètres" }], widgets: [{ key: "revenue", label: "Chiffre d'affaires", description: "Performance commerciale" }] },
  { key: "settings", name: "Paramètres", description: "Configuration entreprise et sécurité", category: "Administration", route: "/dashboard/settings/company", icon: "settings", permissions: ["settings.read"], menuItems: [{ label: "Paramètres", href: "/dashboard/settings/company", section: "Principal" }, { label: "Entreprise", href: "/dashboard/settings/company", section: "Paramètres" }, { label: "Profil", href: "/profile", section: "Paramètres" }, { label: "Utilisateurs", href: "/dashboard/settings/roles", section: "Paramètres" }, { label: "Rôles", href: "/dashboard/settings/roles", section: "Paramètres" }, { label: "Permissions", href: "/dashboard/settings/permissions", section: "Paramètres" }, { label: "Paramètres POS", href: "/dashboard/settings/pos", section: "Paramètres" }, { label: "Facturation", href: "/dashboard/settings/invoicing", section: "Paramètres" }, { label: "Sécurité", href: "/dashboard/security", section: "Paramètres" }, { label: "Sauvegardes", href: "/dashboard/backups", section: "Paramètres" }, { label: "Audit", href: "/dashboard/audit", section: "Paramètres" }, { label: "Business Modules", href: "/dashboard/settings/business-modules", section: "Paramètres" }], widgets: [] },
  { key: "fashion", name: "Mode", description: "Tailles, couleurs et collections", category: "Spécialisé", icon: "shirt", permissions: ["products.view"], menuItems: [{ label: "Tailles et couleurs", href: "/dashboard/products", section: "Produits" }], widgets: [{ key: "fashion-variants", label: "Tailles et couleurs", description: "Variantes vêtements" }] },
  { key: "pharmacy", name: "Pharmacie", description: "Lots, expiration et ordonnances préparées", category: "Spécialisé", icon: "pill", permissions: ["products.view", "inventory.view"], menuItems: [{ label: "Lots et expirations", href: "/dashboard/inventory", section: "Stock" }], widgets: [{ key: "expiring-products", label: "Produits bientôt expirés", description: "Surveillance pharmacie" }] },
  { key: "measurements", name: "Mesures", description: "Longueur, poids, largeur, hauteur", category: "Spécialisé", icon: "ruler", permissions: ["products.view"], menuItems: [{ label: "Mesures", href: "/dashboard/products", section: "Produits" }], widgets: [{ key: "measurements", label: "Mesures", description: "Produits vendus par mesure" }] },
  { key: "restaurant", name: "Restaurant", description: "Tables, cuisine et commandes", category: "Spécialisé", icon: "utensils", permissions: ["pos.sell"], menuItems: [{ label: "Tables", href: "/dashboard/pos", section: "Restaurant" }, { label: "Cuisine", href: "/dashboard/pos", section: "Restaurant" }, { label: "Commandes", href: "/dashboard/pos/history", section: "Restaurant" }], widgets: [{ key: "restaurant-tables", label: "Tables", description: "Tables et commandes" }, { key: "kitchen", label: "Cuisine", description: "Commandes cuisine" }] },
  { key: "hotel", name: "Hôtel", description: "Réservations, chambres et services", category: "Spécialisé", icon: "hotel", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Réservations", href: "/dashboard/customers", section: "Hôtel" }, { label: "Chambres", href: "/dashboard/stores", section: "Hôtel" }], widgets: [{ key: "rooms", label: "Chambres", description: "Occupation préparée" }] },
  { key: "school", name: "Éducation", description: "Élèves, paiements et services scolaires", category: "Spécialisé", icon: "school", permissions: ["customer.read", "payment.read"], menuItems: [{ label: "Élèves", href: "/dashboard/customers", section: "Éducation" }, { label: "Paiements scolaires", href: "/dashboard/payments", section: "Éducation" }], widgets: [{ key: "students", label: "Élèves", description: "Gestion scolaire préparée" }] },
  { key: "printing", name: "Impression", description: "Production, DTF, broderie et laser", category: "Spécialisé", icon: "printer", permissions: ["sales.read"], menuItems: [{ label: "Production", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "DTF", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "Laser", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "Broderie", href: "/dashboard/sales/quotes", section: "Impression" }], widgets: [{ key: "production", label: "Production", description: "Commandes en production" }] },
  { key: "garage", name: "Automobile", description: "Véhicules, réparations et rendez-vous", category: "Spécialisé", icon: "car", permissions: ["customer.read", "products.view", "invoice.read"], menuItems: [{ label: "Véhicules", href: "/dashboard/customers", section: "Automobile" }, { label: "Réparations", href: "/dashboard/sales/invoices", section: "Automobile" }, { label: "Rendez-vous", href: "/dashboard/customers", section: "Automobile" }], widgets: [{ key: "repairs", label: "Réparations", description: "Réparations en cours" }, { key: "appointments", label: "Rendez-vous", description: "Planning garage" }] },
  { key: "services", name: "Services", description: "Services professionnels", category: "Spécialisé", icon: "service", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Services", href: "/dashboard/sales/invoices", section: "Services" }], widgets: [{ key: "services", label: "Services", description: "Services actifs" }] },
  { key: "it-services", name: "Services informatiques", description: "Services IT et clients", category: "Spécialisé", icon: "computer", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Services IT", href: "/dashboard/sales/invoices", section: "Services" }], widgets: [{ key: "it-services", label: "Services informatiques", description: "Services IT actifs" }] }
];

export const businessProfiles: BusinessProfileDefinition[] = [
  { slug: "commerce", name: "Commerce", description: "Modèle simple pour boutiques, markets et grossistes.", category: "Commerce", icon: "store", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings"] },
  { slug: "fashion", name: "Mode & Beauté", description: "Commerce avec tailles, couleurs et collections.", category: "Mode & Beauté", icon: "shirt", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "fashion"] },
  { slug: "restaurant", name: "Restaurant", description: "Tables, cuisine, commandes et POS.", category: "Restaurant & Alimentation", icon: "utensils", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "restaurant"] },
  { slug: "hotel", name: "Hôtel", description: "Hébergement, clients, facturation et services.", category: "Hôtel & Hébergement", icon: "hotel", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "hotel"] },
  { slug: "pharmacy", name: "Pharmacie", description: "Commerce avec lots et expirations.", category: "Santé", icon: "pill", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "pharmacy"] },
  { slug: "clinic", name: "Clinique", description: "Patients, services et facturation.", category: "Santé", icon: "clinic", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "pharmacy"] },
  { slug: "school", name: "Éducation", description: "Élèves, paiements et facturation.", category: "Éducation", icon: "school", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "school"] },
  { slug: "hardware", name: "Quincaillerie", description: "Commerce avec mesures et stock.", category: "Construction", icon: "tool", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "construction-materials", name: "Matériaux", description: "Matériaux de construction et stock lourd.", category: "Construction", icon: "bricks", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "windows-aluminium", name: "Fabrication fenêtres/portes", description: "Fenêtres, portes, cadres, vitrines, moustiquaires, devis avec mesures, acomptes et installation simple.", category: "Construction", icon: "window", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "garage", name: "Automobile", description: "Véhicules, réparations et pièces.", category: "Automobile", icon: "car", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "garage"] },
  { slug: "manufacturing", name: "Fabrication", description: "Ateliers et production artisanale.", category: "Fabrication", icon: "factory", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "printing", name: "Impression", description: "Production, DTF, broderie et communication.", category: "Impression & Communication", icon: "printer", modules: ["dashboard", "pos", "products", "customers", "suppliers", "sales", "reports", "settings", "printing"] },
  { slug: "services", name: "Services", description: "Services professionnels et facturation.", category: "Services", icon: "service", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "services"] },
  { slug: "it-services", name: "Services informatiques", description: "Services IT et clients.", category: "Services", icon: "computer", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "it-services"] },
  { slug: "multi-activities", name: "Multi-activité / Commerce & Services", description: "Commerce, services informatiques, impression, studio photo, fabrication légère et commandes avec acomptes dans un même tenant.", category: "Multi-activité / Commerce & Services", icon: "layers", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "printing", "services", "it-services", "measurements"] }
];

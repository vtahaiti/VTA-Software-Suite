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
  { label: "Boutique de vetements", categoryKey: "fashion-beauty", profileType: "fashion", categories: ["T-shirts", "Jeans", "Robes", "Chaussures", "Casquettes", "Accessoires"] },
  { label: "Supermarche", categoryKey: "commerce", profileType: "commerce", categories: ["Boissons", "Alimentation", "Snacks", "Hygiène", "Détergents"] },
  { label: "Restaurant", categoryKey: "restaurant-food", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts", "Menus", "Extras"] },
  { label: "Bar / Cafe", categoryKey: "restaurant-food", profileType: "restaurant", categories: ["Plats", "Boissons", "Desserts", "Menus", "Extras"] },
  { label: "Hotel", categoryKey: "hotel", profileType: "hotel", categories: ["Chambres", "Services", "Restaurant", "Blanchisserie", "Parking"] },
  { label: "Pharmacie", categoryKey: "health", profileType: "pharmacy", categories: ["Médicaments", "Vitamines", "Hygiène", "Bébé", "Premiers soins"] },
  { label: "Clinique", categoryKey: "health", profileType: "clinic", categories: ["Consultations", "Examens", "Medicaments", "Soins", "Laboratoire"] },
  { label: "Ecole", categoryKey: "education", profileType: "school", categories: ["Écolage", "Uniformes", "Livres", "Frais inscription", "Transport"] },
  { label: "Fabrication", categoryKey: "manufacturing", profileType: "manufacturing", categories: ["Aluminium", "Vitres", "Portes", "Accessoires", "Matières premières", "Produits finis"] },
  { label: "Portes / Fenetres / Aluminium", categoryKey: "construction", profileType: "windows-aluminium", categories: ["Aluminium", "Vitres", "Portes", "Accessoires", "Matières premières", "Produits finis"] },
  { label: "Materiaux de construction", categoryKey: "construction", profileType: "construction-materials", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Électricité"] },
  { label: "Quincaillerie", categoryKey: "construction", profileType: "hardware", categories: ["Ciment", "Fer", "Bois", "Peinture", "Plomberie", "Électricité"] },
  { label: "Garage", categoryKey: "automotive", profileType: "garage", categories: ["Pièces", "Services", "Lubrifiants", "Pneus", "Diagnostic"] },
  { label: "Telephones & Electronique", categoryKey: "commerce", profileType: "commerce", categories: ["Telephones", "Accessoires", "Chargeurs", "Ecouteurs", "Ordinateurs", "Pieces"] },
  { label: "Informatique", categoryKey: "services", profileType: "it-services", categories: ["Services IT", "Ordinateurs", "Reseaux", "Logiciels", "Accessoires"] },
  { label: "Imprimerie / Publicite", categoryKey: "printing-communication", profileType: "printing", categories: ["DTF", "Broderie", "Sérigraphie", "Sublimation", "Laser"] },
  { label: "Cadeaux / Souvenirs", categoryKey: "commerce", profileType: "commerce", categories: ["Cadeaux", "Souvenirs", "Decoration", "Cartes", "Accessoires"] },
  { label: "Meubles", categoryKey: "commerce", profileType: "commerce", categories: ["Chaises", "Tables", "Lits", "Armoires", "Canapes", "Decoration"] },
  { label: "Chaussures", categoryKey: "fashion-beauty", profileType: "fashion", categories: ["Hommes", "Femmes", "Enfants", "Sandales", "Baskets", "Accessoires"] },
  { label: "Cosmetique", categoryKey: "fashion-beauty", profileType: "commerce", categories: ["Maquillage", "Soins visage", "Soins cheveux", "Parfums", "Hygiene", "Accessoires"] },
  { label: "Boucherie", categoryKey: "restaurant-food", profileType: "commerce", categories: ["Boeuf", "Porc", "Poulet", "Charcuterie", "Congeles"] },
  { label: "Poissonnerie", categoryKey: "restaurant-food", profileType: "commerce", categories: ["Poissons", "Fruits de mer", "Congeles", "Epices", "Preparations"] },
  { label: "Boulangerie", categoryKey: "restaurant-food", profileType: "commerce", categories: ["Pains", "Viennoiseries", "Gateaux", "Boissons", "Snacks"] },
  { label: "Agriculture", categoryKey: "agriculture", profileType: "commerce", categories: ["Semences", "Engrais", "Outils", "Recoltes", "Aliments betail"] },
  { label: "Elevage", categoryKey: "agriculture", profileType: "commerce", categories: ["Poulets", "Betail", "Aliments", "Medicaments", "Equipements"] },
  { label: "Distribution", categoryKey: "transport-distribution", profileType: "commerce", categories: ["Produits distribues", "Livraisons", "Emballages", "Retours", "Services"] },
  { label: "Multi-activites", categoryKey: "multi-activities", profileType: "multi-activities", categories: ["Commerce", "Services", "Production", "Stock", "Commandes"] },
  { label: "Autre", categoryKey: "other", profileType: "commerce", categories: ["General", "Produits", "Services"] }
];

export function activityLabelWithoutIcon(label: string) {
  return label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function findActivityTemplate(activityName?: string) {
  const normalized = activityName?.trim();
  return businessActivityTemplates.find((template) => template.label === normalized || activityLabelWithoutIcon(template.label) === normalized) ?? businessActivityTemplates[0];
}

export const businessCategories: BusinessCategoryDefinition[] = [
  { key: "commerce", name: "Commerce", description: "Boutiques, markets, supermarches et grossistes.", activities: [
    { name: "Boutique / Market", profileType: "commerce" }, { name: "Supermarche", profileType: "commerce" }, { name: "Depot de boissons", profileType: "commerce" }, { name: "Grossiste", profileType: "commerce" }, { name: "Librairie", profileType: "commerce" }, { name: "Electronique", profileType: "commerce" }, { name: "Telephones & Accessoires", profileType: "commerce" }
  ] },
  { key: "fashion-beauty", name: "Mode & Beaute", description: "Vetements, chaussures, cosmetique et salons.", activities: [
    { name: "Boutique vetements", profileType: "fashion" }, { name: "Chaussures", profileType: "fashion" }, { name: "Bijouterie", profileType: "commerce" }, { name: "Cosmetique", profileType: "commerce" }, { name: "Salon de beaute", profileType: "services" }, { name: "Barber shop", profileType: "services" }
  ] },
  { key: "restaurant-food", name: "Restaurant & Alimentation", description: "Restaurant, bar, boulangerie et alimentation préparée.", activities: [
    { name: "Restaurant", profileType: "restaurant" }, { name: "Fast-food", profileType: "restaurant" }, { name: "Bar", profileType: "restaurant" }, { name: "Boulangerie", profileType: "commerce" }, { name: "Patisserie", profileType: "commerce" }, { name: "Glacier", profileType: "commerce" }
  ] },
  { key: "hotel", name: "Hotel & Hebergement", description: "Hotels, maisons d'hotes et auberges.", activities: [
    { name: "Hotel", profileType: "hotel" }, { name: "Maison d'hotes", profileType: "hotel" }, { name: "Auberge", profileType: "hotel" }
  ] },
  { key: "health", name: "Sante", description: "Pharmacies, cliniques et cabinets medicaux.", activities: [
    { name: "Pharmacie", profileType: "pharmacy" }, { name: "Clinique", profileType: "clinic" }, { name: "Cabinet medical", profileType: "clinic" }, { name: "Laboratoire", profileType: "clinic" }
  ] },
  { key: "education", name: "Education", description: "Ecoles, universites et centres de formation.", activities: [
    { name: "Ecole", profileType: "school" }, { name: "Universite", profileType: "school" }, { name: "Centre de formation", profileType: "school" }, { name: "Creche", profileType: "school" }
  ] },
  { key: "construction", name: "Construction", description: "Quincaillerie, materiaux, electricite et ateliers.", activities: [
    { name: "Quincaillerie", profileType: "hardware" }, { name: "Materiaux de construction", profileType: "construction-materials" }, { name: "Electricite", profileType: "commerce" }, { name: "Plomberie", profileType: "commerce" }, { name: "Aluminium / Vitrerie", profileType: "windows-aluminium" }, { name: "Menuiserie", profileType: "manufacturing" }, { name: "Ferronnerie", profileType: "manufacturing" }
  ] },
  { key: "automotive", name: "Automobile", description: "Garage, pieces auto, car wash et location.", activities: [
    { name: "Garage", profileType: "garage" }, { name: "Vente de pieces auto", profileType: "garage" }, { name: "Car Wash", profileType: "garage" }, { name: "Location de vehicules", profileType: "services" }
  ] },
  { key: "manufacturing", name: "Fabrication", description: "Ateliers, soudure et production artisanale.", activities: [
    { name: "Atelier aluminium", profileType: "windows-aluminium" }, { name: "Menuiserie bois", profileType: "manufacturing" }, { name: "Ferronnerie", profileType: "manufacturing" }, { name: "Soudure", profileType: "manufacturing" }, { name: "Production artisanale", profileType: "manufacturing" }
  ] },
  { key: "printing-communication", name: "Impression & Communication", description: "Imprimerie, DTF, broderie, pub et studio photo.", activities: [
    { name: "Imprimerie", profileType: "printing" }, { name: "Serigraphie", profileType: "printing" }, { name: "Broderie", profileType: "printing" }, { name: "DTF", profileType: "printing" }, { name: "Sublimation", profileType: "printing" }, { name: "Agence publicite", profileType: "printing" }, { name: "Studio photo", profileType: "services" }
  ] },
  { key: "services", name: "Services", description: "Services professionnels et informatiques.", activities: [
    { name: "Cabinet comptable", profileType: "services" }, { name: "Cabinet d'avocats", profileType: "services" }, { name: "Agence immobiliere", profileType: "services" }, { name: "Agence de voyage", profileType: "services" }, { name: "Entreprise sécurité", profileType: "services" }, { name: "Cybercafe", profileType: "it-services" }, { name: "Services informatiques", profileType: "it-services" }
  ] },
  { key: "agriculture", name: "Agriculture", description: "Agro-business, ferme et elevage.", activities: [
    { name: "Agro-business", profileType: "commerce" }, { name: "Ferme", profileType: "commerce" }, { name: "Elevage", profileType: "commerce" }
  ] },
  { key: "transport-distribution", name: "Transport & Distribution", description: "Transport, livraison et distribution.", activities: [
    { name: "Distribution", profileType: "commerce" }, { name: "Transport", profileType: "services" }, { name: "Messagerie", profileType: "services" }, { name: "Livraison", profileType: "services" }
  ] },
  { key: "organizations", name: "Organisations", description: "ONG, eglises, associations et cooperatives.", activities: [
    { name: "ONG", profileType: "services" }, { name: "Eglise", profileType: "services" }, { name: "Association", profileType: "services" }, { name: "Cooperative", profileType: "commerce" }
  ] },
  { key: "multi-activities", name: "Multi-activites", description: "Entreprises avec plusieurs activites.", activities: [
    { name: "Entreprise multi-services", profileType: "multi-activities" }, { name: "Groupe d'entreprises", profileType: "multi-activities" }, { name: "Holding", profileType: "multi-activities" }, { name: "Autre multi-activites", profileType: "multi-activities" }
  ] },
  { key: "other", name: "Autre", description: "Activite non listee.", activities: [{ name: "Autre activite", profileType: "commerce" }] }
];

export function resolveBusinessProfileSlug(categoryKey?: string, activityName?: string) {
  const template = findActivityTemplate(activityName);
  if (template) return template.profileType;
  const category = businessCategories.find((item) => item.key === categoryKey) ?? businessCategories[0];
  const activity = category.activities.find((item) => item.name === activityName) ?? category.activities[0];
  return activity.profileType || "commerce";
}

export const businessModules: BusinessModuleDefinition[] = [
  { key: "dashboard", name: "Accueil", description: "Vue simple de l'entreprise", category: "General", route: "/dashboard", icon: "home", permissions: ["dashboard.view"], isCore: true, menuItems: [{ label: "Accueil", href: "/dashboard", section: "Principal" }], widgets: [{ key: "overview", label: "Synthese", description: "Indicateurs essentiels" }] },
  { key: "pos", name: "Nouvelle vente", description: "Vente rapide, caisse et tickets", category: "Vente", route: "/dashboard/pos", icon: "pos", permissions: ["pos.sell"], menuItems: [{ label: "Nouvelle vente", href: "/dashboard/pos", section: "Principal" }, { label: "Historique POS", href: "/dashboard/pos/history", section: "Ventes" }, { label: "Sessions caisse", href: "/dashboard/pos/sessions", section: "Paramètres" }, { label: "Caisses", href: "/dashboard/cash-registers", section: "Paramètres" }], widgets: [{ key: "sales-today", label: "Ventes du jour", description: "Ventes POS aujourd'hui" }] },
  { key: "products", name: "Produits", description: "Catalogue produits et variantes", category: "Catalogue", route: "/dashboard/products", icon: "box", permissions: ["products.view"], menuItems: [{ label: "Produits", href: "/dashboard/products", section: "Produits" }, { label: "Catégories", href: "/dashboard/products/categories", section: "Produits" }, { label: "Marques", href: "/dashboard/products/brands", section: "Produits" }, { label: "Unités", href: "/dashboard/products/units", section: "Produits" }], widgets: [{ key: "products", label: "Produits", description: "Produits actifs" }] },
  { key: "inventory", name: "Stock", description: "Stock, mouvements, alertes et transferts", category: "Stock", route: "/dashboard/inventory", icon: "warehouse", permissions: ["inventory.view"], menuItems: [{ label: "Stock", href: "/dashboard/inventory", section: "Stock" }, { label: "Mouvements", href: "/dashboard/inventory/movements", section: "Stock" }, { label: "Ajustements", href: "/dashboard/inventory/adjustments", section: "Stock" }, { label: "Transferts", href: "/dashboard/transfers", section: "Stock" }, { label: "Magasins", href: "/dashboard/stores", section: "Stock" }, { label: "Entrepôts", href: "/dashboard/warehouses", section: "Stock" }], widgets: [{ key: "low-stock", label: "Stock faible", description: "Produits sous seuil" }, { key: "stock-by-store", label: "Stock par magasin", description: "Stock repartit par point de vente" }] },
  { key: "customers", name: "Clients", description: "CRM, soldes et historique", category: "Commercial", route: "/dashboard/customers", icon: "users", permissions: ["customer.read"], menuItems: [{ label: "Clients", href: "/dashboard/customers", section: "Principal" }], widgets: [{ key: "customers", label: "Clients", description: "Clients actifs" }] },
  { key: "suppliers", name: "Achats", description: "Fournisseurs, achats et receptions", category: "Commercial", route: "/dashboard/purchases", icon: "truck", permissions: ["suppliers.view"], menuItems: [{ label: "Fournisseurs", href: "/dashboard/suppliers", section: "Achats" }, { label: "Achats", href: "/dashboard/purchases", section: "Achats" }, { label: "Réceptions", href: "/dashboard/purchases/receipts", section: "Achats" }, { label: "Factures fournisseurs", href: "/dashboard/purchases/invoices", section: "Achats" }, { label: "Paiements fournisseurs", href: "/dashboard/purchases/payments", section: "Achats" }], widgets: [{ key: "pending-purchases", label: "Achats en attente", description: "Commandes fournisseurs ouvertes" }] },
  { key: "sales", name: "Ventes", description: "Devis, factures, paiements et retours", category: "Ventes", route: "/dashboard/sales", icon: "receipt", permissions: ["sales.read"], menuItems: [{ label: "Ventes", href: "/dashboard/sales", section: "Principal" }, { label: "Devis", href: "/dashboard/sales/quotes", section: "Ventes" }, { label: "Proformas", href: "/dashboard/sales/proformas", section: "Ventes" }, { label: "Factures", href: "/dashboard/sales/invoices", section: "Ventes" }, { label: "Retours", href: "/dashboard/sales/returns", section: "Ventes" }, { label: "Paiements", href: "/dashboard/payments", section: "Ventes" }], widgets: [{ key: "invoices", label: "Factures", description: "Documents de vente" }] },
  { key: "reports", name: "Rapports", description: "Rapports business et exports", category: "Administration", route: "/dashboard/reports", icon: "chart", permissions: ["reports.read"], menuItems: [{ label: "Rapports", href: "/dashboard/reports", section: "Principal" }, { label: "Import / Export", href: "/dashboard/import-export", section: "Paramètres" }], widgets: [{ key: "revenue", label: "Chiffre d'affaires", description: "Performance commerciale" }] },
  { key: "settings", name: "Paramètres", description: "Configuration entreprise et sécurité", category: "Administration", route: "/dashboard/settings/company", icon: "settings", permissions: ["settings.read"], menuItems: [{ label: "Paramètres", href: "/dashboard/settings/company", section: "Principal" }, { label: "Entreprise", href: "/dashboard/settings/company", section: "Paramètres" }, { label: "Profil", href: "/profile", section: "Paramètres" }, { label: "Utilisateurs", href: "/dashboard/settings/roles", section: "Paramètres" }, { label: "Roles", href: "/dashboard/settings/roles", section: "Paramètres" }, { label: "Permissions", href: "/dashboard/settings/permissions", section: "Paramètres" }, { label: "Paramètres POS", href: "/dashboard/settings/pos", section: "Paramètres" }, { label: "Facturation", href: "/dashboard/settings/invoicing", section: "Paramètres" }, { label: "Sécurité", href: "/dashboard/security", section: "Paramètres" }, { label: "Sauvegardes", href: "/dashboard/backups", section: "Paramètres" }, { label: "Audit", href: "/dashboard/audit", section: "Paramètres" }, { label: "Business Modules", href: "/dashboard/settings/business-modules", section: "Paramètres" }], widgets: [] },
  { key: "fashion", name: "Mode", description: "Tailles, couleurs et collections", category: "Specialise", icon: "shirt", permissions: ["products.view"], menuItems: [{ label: "Tailles et couleurs", href: "/dashboard/products", section: "Produits" }], widgets: [{ key: "fashion-variants", label: "Tailles et couleurs", description: "Variantes vetements" }] },
  { key: "pharmacy", name: "Pharmacie", description: "Lots, expiration et ordonnances préparées", category: "Specialise", icon: "pill", permissions: ["products.view", "inventory.view"], menuItems: [{ label: "Lots et expirations", href: "/dashboard/inventory", section: "Stock" }], widgets: [{ key: "expiring-products", label: "Produits bientot expires", description: "Surveillance pharmacie" }] },
  { key: "measurements", name: "Mesures", description: "Longueur, poids, largeur, hauteur", category: "Specialise", icon: "ruler", permissions: ["products.view"], menuItems: [{ label: "Mesures", href: "/dashboard/products", section: "Produits" }], widgets: [{ key: "measurements", label: "Mesures", description: "Produits vendus par mesure" }] },
  { key: "restaurant", name: "Restaurant", description: "Tables, cuisine et commandes", category: "Specialise", icon: "utensils", permissions: ["pos.sell"], menuItems: [{ label: "Tables", href: "/dashboard/pos", section: "Restaurant" }, { label: "Cuisine", href: "/dashboard/pos", section: "Restaurant" }, { label: "Commandes", href: "/dashboard/pos/history", section: "Restaurant" }], widgets: [{ key: "restaurant-tables", label: "Tables", description: "Tables et commandes" }, { key: "kitchen", label: "Cuisine", description: "Commandes cuisine" }] },
  { key: "hotel", name: "Hotel", description: "Reservations, chambres et services", category: "Specialise", icon: "hotel", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Reservations", href: "/dashboard/customers", section: "Hotel" }, { label: "Chambres", href: "/dashboard/stores", section: "Hotel" }], widgets: [{ key: "rooms", label: "Chambres", description: "Occupation préparée" }] },
  { key: "school", name: "Education", description: "Eleves, paiements et services scolaires", category: "Specialise", icon: "school", permissions: ["customer.read", "payment.read"], menuItems: [{ label: "Eleves", href: "/dashboard/customers", section: "Education" }, { label: "Paiements scolaires", href: "/dashboard/payments", section: "Education" }], widgets: [{ key: "students", label: "Eleves", description: "Gestion scolaire préparée" }] },
  { key: "printing", name: "Impression", description: "Production, DTF, broderie et laser", category: "Specialise", icon: "printer", permissions: ["sales.read"], menuItems: [{ label: "Production", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "DTF", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "Laser", href: "/dashboard/sales/quotes", section: "Impression" }, { label: "Broderie", href: "/dashboard/sales/quotes", section: "Impression" }], widgets: [{ key: "production", label: "Production", description: "Commandes en production" }] },
  { key: "garage", name: "Automobile", description: "Vehicules, reparations et rendez-vous", category: "Specialise", icon: "car", permissions: ["customer.read", "products.view", "invoice.read"], menuItems: [{ label: "Vehicules", href: "/dashboard/customers", section: "Automobile" }, { label: "Reparations", href: "/dashboard/sales/invoices", section: "Automobile" }, { label: "Rendez-vous", href: "/dashboard/customers", section: "Automobile" }], widgets: [{ key: "repairs", label: "Reparations", description: "Reparations en cours" }, { key: "appointments", label: "Rendez-vous", description: "Planning garage" }] },
  { key: "services", name: "Services", description: "Services professionnels", category: "Specialise", icon: "service", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Services", href: "/dashboard/sales/invoices", section: "Services" }], widgets: [{ key: "services", label: "Services", description: "Services actifs" }] },
  { key: "it-services", name: "Services informatiques", description: "Services IT et clients", category: "Specialise", icon: "computer", permissions: ["customer.read", "invoice.read"], menuItems: [{ label: "Services IT", href: "/dashboard/sales/invoices", section: "Services" }], widgets: [{ key: "it-services", label: "Services informatiques", description: "Services IT actifs" }] }
];

export const businessProfiles: BusinessProfileDefinition[] = [
  { slug: "commerce", name: "Commerce", description: "Modele simple pour boutiques, markets et grossistes.", category: "Commerce", icon: "store", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings"] },
  { slug: "fashion", name: "Mode & Beaute", description: "Commerce avec tailles, couleurs et collections.", category: "Mode & Beaute", icon: "shirt", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "fashion"] },
  { slug: "restaurant", name: "Restaurant", description: "Tables, cuisine, commandes et POS.", category: "Restaurant & Alimentation", icon: "utensils", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "restaurant"] },
  { slug: "hotel", name: "Hotel", description: "Hebergement, clients, facturation et services.", category: "Hotel & Hebergement", icon: "hotel", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "hotel"] },
  { slug: "pharmacy", name: "Pharmacie", description: "Commerce avec lots et expirations.", category: "Sante", icon: "pill", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "pharmacy"] },
  { slug: "clinic", name: "Clinique", description: "Patients, services et facturation.", category: "Sante", icon: "clinic", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "pharmacy"] },
  { slug: "school", name: "Education", description: "Eleves, paiements et facturation.", category: "Education", icon: "school", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "school"] },
  { slug: "hardware", name: "Quincaillerie", description: "Commerce avec mesures et stock.", category: "Construction", icon: "tool", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "construction-materials", name: "Materiaux", description: "Materiaux de construction et stock lourd.", category: "Construction", icon: "bricks", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "windows-aluminium", name: "Aluminium / Vitrerie", description: "Mesures, devis et installation.", category: "Construction", icon: "window", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "garage", name: "Automobile", description: "Vehicules, reparations et pieces.", category: "Automobile", icon: "car", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "garage"] },
  { slug: "manufacturing", name: "Fabrication", description: "Ateliers et production artisanale.", category: "Fabrication", icon: "factory", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "measurements"] },
  { slug: "printing", name: "Impression", description: "Production, DTF, broderie et communication.", category: "Impression & Communication", icon: "printer", modules: ["dashboard", "pos", "products", "customers", "suppliers", "sales", "reports", "settings", "printing"] },
  { slug: "services", name: "Services", description: "Services professionnels et facturation.", category: "Services", icon: "service", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "services"] },
  { slug: "it-services", name: "Services informatiques", description: "Services IT et clients.", category: "Services", icon: "computer", modules: ["dashboard", "pos", "customers", "sales", "reports", "settings", "it-services"] },
  { slug: "multi-activities", name: "Multi-activites", description: "Plusieurs activites dans une meme entreprise.", category: "Multi-activites", icon: "layers", modules: ["dashboard", "pos", "products", "inventory", "customers", "suppliers", "sales", "reports", "settings", "printing", "garage", "it-services", "measurements", "restaurant"] }
];

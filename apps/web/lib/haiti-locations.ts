export type HaitiDepartment = {
  department: string;
  cities: string[];
};

export const haitiDepartments: HaitiDepartment[] = [
  {
    department: "Artibonite",
    cities: ["Gonaives", "Saint-Marc", "Dessalines", "Desdunes", "Ennery", "Estere", "Gros-Morne", "Marmelade", "Terre-Neuve", "Verrettes", "La Chapelle", "Liancourt", "Petite-Riviere-de-l'Artibonite", "Marchand-Dessalines", "Anse-Rouge"]
  },
  {
    department: "Centre",
    cities: ["Hinche", "Mirebalais", "Lascahobas", "Saut-d'Eau", "Boucan-Carre", "Maissade", "Thomonde", "Thomassique", "Cerca-la-Source", "Cerca-Carvajal", "Belladere"]
  },
  {
    department: "Grand'Anse",
    cities: ["Jeremie", "Abricots", "Bonbon", "Moron", "Chambellan", "Anse-d'Hainault", "Dame-Marie", "Les Irois", "Roseaux", "Beaumont", "Corail", "Pestel"]
  },
  {
    department: "Nippes",
    cities: ["Miragoane", "Petite-Riviere-de-Nippes", "Fonds-des-Negres", "Paillant", "Anse-a-Veau", "Arnaud", "L'Asile", "Plaisance-du-Sud", "Baraderes", "Grand-Boucan"]
  },
  {
    department: "Nord",
    cities: ["Cap-Haitien", "Acul-du-Nord", "Plaine-du-Nord", "Milot", "Quartier-Morin", "Limonade", "Grande-Riviere-du-Nord", "Bahon", "Saint-Raphael", "Dondon", "Ranquitte", "Pignon", "La Victoire", "Borgne", "Port-Margot", "Limbe", "Bas-Limbe", "Pilate", "Plaisance"]
  },
  {
    department: "Nord-Est",
    cities: ["Fort-Liberte", "Ferrier", "Perches", "Ouanaminthe", "Capotille", "Mont-Organise", "Trou-du-Nord", "Sainte-Suzanne", "Terrier-Rouge", "Caracol", "Vallieres", "Mombin-Crochu"]
  },
  {
    department: "Nord-Ouest",
    cities: ["Port-de-Paix", "La Tortue", "Bassin-Bleu", "Chansolme", "Saint-Louis-du-Nord", "Anse-a-Foleur", "Jean-Rabel", "Bombardopolis", "Baie-de-Henne", "Mole-Saint-Nicolas"]
  },
  {
    department: "Ouest",
    cities: ["Port-au-Prince", "Delmas", "Petion-Ville", "Carrefour", "Croix-des-Bouquets", "Tabarre", "Cite Soleil", "Kenscoff", "Gressier", "Leogane", "Petit-Goave", "Grand-Goave", "Cabaret", "Arcahaie", "Ganthier", "Thomazeau", "Cornillon", "Fonds-Verrettes"]
  },
  {
    department: "Sud",
    cities: ["Les Cayes", "Torbeck", "Chantal", "Camp-Perrin", "Maniche", "Ile-a-Vache", "Saint-Louis-du-Sud", "Cavaillon", "Aquin", "Saint-Jean-du-Sud", "Arniquet", "Port-Salut", "Roche-a-Bateau", "Coteaux", "Port-a-Piment", "Chardonnieres", "Tiburon"]
  },
  {
    department: "Sud-Est",
    cities: ["Jacmel", "Cayes-Jacmel", "Marigot", "La Vallee-de-Jacmel", "Bainet", "Cotes-de-Fer", "Belle-Anse", "Thiotte", "Grand-Gosier", "Anse-a-Pitres"]
  }
];

export const haitiDepartmentNames = haitiDepartments.map((item) => item.department);

export function citiesForHaitiDepartment(department: string) {
  return haitiDepartments.find((item) => item.department === department)?.cities ?? [];
}

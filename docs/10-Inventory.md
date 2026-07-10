# Inventory Management

## Objectif

Le module Inventory est le cœur de la gestion des stocks de VTA Software Suite.

Tous les autres modules (POS, Hotel, Pharmacy, Garage, School, Restaurant...) utilisent ce module.

---

# Fonctionnalités

- Gestion des produits
- Gestion des catégories
- Gestion des marques
- Gestion des unités
- Gestion des variantes
- Gestion des lots
- Gestion des dates d'expiration
- Gestion des entrepôts
- Gestion des magasins
- Gestion des transferts
- Gestion des mouvements de stock
- Ajustement de stock
- Inventaire physique

---

# Produits

Chaque produit possède :

- Code
- Code-barres
- QR Code
- Nom
- Description
- Catégorie
- Marque
- Unité
- Prix d'achat
- Prix de vente
- Coût moyen
- TVA
- Images
- Statut

---

# Gestion des stocks

Le système doit connaître en temps réel :

- Quantité disponible
- Quantité réservée
- Quantité commandée
- Quantité minimale
- Quantité maximale

---

# Entrepôts

Un Tenant peut posséder plusieurs :

- Entrepôts
- Magasins
- Dépôts

Chaque stock est géré indépendamment.

---

# Mouvements

Tous les mouvements doivent être enregistrés.

Exemples :

- Achat
- Vente
- Retour
- Perte
- Ajustement
- Transfert

---

# Traçabilité

Chaque mouvement possède :

- Date
- Heure
- Utilisateur
- Module
- Référence
- Quantité

---

# Intégrations

Le module Inventory communique avec :

- POS
- Purchases
- Sales
- Pharmacy
- Garage
- Hotel
- Accounting

---

# Règles

Le stock ne peut jamais devenir négatif sauf si cette option est activée par l'administrateur.

Toutes les modifications sont enregistrées dans les Audit Logs.
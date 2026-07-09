# Purchases

## Objectif

Le module Purchases permet de gérer tous les achats effectués auprès des fournisseurs.

Chaque achat met automatiquement à jour le stock et les informations financières.

---

# Fonctionnalités

- Création d'un bon de commande
- Réception des marchandises
- Facture fournisseur
- Retour fournisseur
- Historique des achats
- Gestion des coûts
- Gestion des remises
- Gestion des taxes

---

# Fournisseurs

Chaque fournisseur possède :

- Code
- Nom
- Téléphone
- Email
- Adresse
- Personne de contact
- Conditions de paiement

---

# Bon de commande

Chaque bon contient :

- Fournisseur
- Produits
- Quantités
- Prix
- Taxes
- Remises
- Date
- Statut

---

# Réception

Lors de la réception :

- Le stock est mis à jour automatiquement.
- Le coût moyen est recalculé.
- Un mouvement de stock est créé.
- Un Audit Log est enregistré.

---

# Statuts

- Brouillon
- Envoyé
- Partiellement reçu
- Reçu
- Annulé

---

# Intégrations

Le module Purchases communique avec :

- Inventory
- Accounting
- Audit Logs

---

# Règles

Un achat ne peut pas être supprimé après validation.

Toute modification doit être enregistrée dans les Audit Logs.
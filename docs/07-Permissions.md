# Permissions

## Objectif

Les permissions déterminent précisément ce qu'un utilisateur peut faire dans une entreprise.

---

## Principe

Les permissions sont attribuées aux rôles.

Les utilisateurs héritent automatiquement des permissions de leurs rôles.

---

## Exemples de permissions

### Utilisateurs

- users.create
- users.read
- users.update
- users.delete

### Clients

- customers.create
- customers.read
- customers.update
- customers.delete

### Produits

- products.create
- products.read
- products.update
- products.delete

### Ventes

- sales.create
- sales.read
- sales.cancel
- sales.refund

### Rapports

- reports.read

### Paramètres

- settings.read
- settings.update

---

## Vérification

Chaque requête doit vérifier les permissions avant d'autoriser l'action.

---

## Règle

Aucune permission ne doit être accordée directement à un utilisateur.

Toutes les permissions passent par les rôles.
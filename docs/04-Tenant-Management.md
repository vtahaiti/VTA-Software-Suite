# Tenant Management

## Objectif

Le système de Tenant Management permet à plusieurs entreprises d'utiliser la même plateforme tout en gardant leurs données totalement séparées.

---

## Définition

Un Tenant représente une entreprise.

Exemples :

- VTA Enterprise
- Hôtel Sunrise
- Pharmacie Santé Plus
- Garage Express

Chaque entreprise possède :

- son nom
- son logo
- ses utilisateurs
- ses rôles
- ses permissions
- ses paramètres
- ses données

---

## Isolation des données

Toutes les données doivent appartenir à un Tenant.

Aucune donnée ne peut être consultée par une autre entreprise.

Chaque requête devra contenir le Tenant actif.

---

## Changement de Tenant

Si un utilisateur appartient à plusieurs entreprises, il pourra changer de Tenant sans devoir se reconnecter.

---

## Règle obligatoire

Toutes les tables de la base de données devront contenir un tenantId.
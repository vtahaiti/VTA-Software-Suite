# VTA Software Suite

## Master Plan v1.0

**Project Name:** VTA Software Suite

**Owner:** Gerthley Dorvil (VTA)

**Chief Software Architect:** ChatGPT

**Repository:** VTA-Software-Suite

---

# Vision

VTA Software Suite est une plateforme SaaS professionnelle multi-tenant conçue pour permettre aux entreprises de gérer leurs activités à partir d'un écosystème unique.

Notre objectif est de construire un logiciel moderne, sécurisé, évolutif et commercialisable, capable de servir des milliers d'entreprises dans plusieurs secteurs :

- VTA POS
- VTA School
- VTA Hotel
- VTA Pharmacy
- VTA Garage

Le développement suivra une approche "Architecture First" : aucune fonctionnalité ne sera développée avant d'avoir été conçue, documentée et validée.

---

# Nos Principes

- Architecture avant le développement
- Un seul écosystème
- Multi-tenant dès le premier jour
- Code propre et maintenable
- Sécurité par conception
- Performance
- Documentation complète
- Modules réutilisables
---

# Architecture Technique Officielle

VTA Software Suite utilisera une architecture moderne, modulaire et évolutive.

## Stack Technique

| Élément | Technologie |
|--------|-------------|
| Frontend | Next.js + React + TypeScript |
| Backend | NestJS + TypeScript |
| Base de données | PostgreSQL |
| ORM | Prisma |
| Déploiement | Docker |
| Cache | Redis |
| Stockage fichiers | S3 Compatible |

## Principe fondamental

Le projet suivra une approche **Architecture First**.

Aucune fonctionnalité ne sera développée avant d'avoir été conçue, documentée et validée.
---

# Architecture Générale de VTA Software Suite

VTA Software Suite est construit autour d'un **Core Platform** partagé par tous les modules.

Tous les modules utilisent les mêmes services communs (authentification, utilisateurs, rôles, permissions, paramètres, notifications, journaux et abonnements), ce qui garantit une architecture cohérente et évolutive.

## Structure générale

```text
                    VTA Software Suite
                           │
            ┌──────────────┴──────────────┐
            │                             │
      Authentication                 Core Platform
            │                             │
 Users / Roles / Permissions   Settings / Logs / Billing
            │                             │
   ┌────────┼────────┬────────┬───────────┐
   │        │        │        │
 VTA POS  School   Hotel   Pharmacy   Garage
```

## Principes de l'architecture

- Un seul système d'authentification.
- Un seul système de gestion des utilisateurs.
- Un seul système de rôles et permissions.
- Tous les modules partagent le Core Platform.
- Chaque module est indépendant mais réutilise les services communs.
- L'architecture doit permettre d'ajouter de nouveaux modules sans modifier les modules existants.
---

# Core Platform

## Définition

Le Core Platform est le cœur de VTA Software Suite.

Tous les modules (POS, School, Hotel, Pharmacy, Garage et futurs modules) utiliseront les services du Core Platform.

Le Core Platform ne contient aucune logique métier spécifique à un module. Il fournit uniquement les services communs utilisés par toute la plateforme.

---

## Objectifs

Le Core Platform a pour objectif de :

- Centraliser les fonctionnalités communes.
- Éviter la duplication de code.
- Faciliter l'ajout de nouveaux modules.
- Garantir une architecture uniforme.
- Simplifier la maintenance.
- Améliorer la sécurité.

---

## Services du Core Platform

Le Core Platform est composé des services suivants :

### Authentication

Gestion de la connexion.

- Login
- Logout
- Mot de passe oublié
- Double authentification (future version)
- Gestion des sessions

---

### Users

Gestion des utilisateurs.

- Création
- Modification
- Désactivation
- Profil

---

### Roles & Permissions

Gestion des accès.

Exemples :

- Administrateur
- Manager
- Caissier
- Comptable
- Employé

Chaque rôle possède des permissions spécifiques.

---

### Tenant Management

Gestion des entreprises.

Chaque entreprise possède :

- ses utilisateurs
- ses données
- ses paramètres
- ses modules
- son abonnement

Les entreprises ne peuvent jamais accéder aux données des autres entreprises.

---

### Settings

Paramètres généraux.

- Langue
- Fuseau horaire
- Devise
- Taxes
- Informations de l'entreprise
- Logo

---

### Notifications

Gestion des notifications.

- Email
- Notifications internes
- SMS (future version)
- WhatsApp (future version)

---

### Audit Logs

Historique complet des actions.

Toutes les actions importantes sont enregistrées.

Exemples :

- Connexion
- Vente supprimée
- Utilisateur créé
- Modification des paramètres

---

### Billing

Gestion des abonnements SaaS.

- Plan Free
- Plan Basic
- Plan Pro
- Plan Enterprise

---

### File Storage

Gestion des fichiers.

- Logos
- Photos
- Factures
- Documents
- Pièces jointes

---

### API

Tous les modules communiqueront avec le Core Platform via une API interne.

# Core Architecture

## Objectif

Le Core Platform est le cœur de VTA Software Suite.

Tous les modules utilisent les services du Core.

Le Core ne contient aucune logique métier spécifique (POS, School, Hotel, Garage...).

Il fournit uniquement les services communs.

---

## Services du Core

- Authentication
- Tenant Management
- Users
- Roles
- Permissions
- Settings
- Notifications
- Audit Logs
- Billing
- File Storage
- API Gateway

---

## Principe

Tous les modules communiquent uniquement avec le Core.

Aucun module ne communique directement avec un autre module.

Exemple :

VTA POS
      │
VTA School
      │
VTA Hotel
      │
VTA Garage
      │
      ▼
Core Platform
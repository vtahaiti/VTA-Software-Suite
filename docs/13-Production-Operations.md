# VTA ERP - Exploitation production

Ce document sert de checklist simple pour garder VTA ERP en ligne, sauvegarde et surveille.

## URLs

- Web client : `https://vtaerp.com`
- Super Admin : `https://admin.vtaerp.com/admin/login`
- API : `https://api.vtaerp.com`
- Sante API : `https://api.vtaerp.com/health`
- Sante API + base : `https://api.vtaerp.com/health/ready`

## Verification rapide

Depuis le depot :

```powershell
npm run prod:check
```

Variables utiles pour tester le Super Admin :

```env
SUPER_ADMIN_EMAIL="admin@vtaerp.com"
SUPER_ADMIN_PASSWORD="mot-de-passe-fort"
```

## Serveur actuel

Mesure du 9 juillet 2026 :

- CPU : 2 vCPU
- RAM : 7.8 GiB
- Disque : 96 GB, environ 70 GB libres
- Containers : API, Web, PostgreSQL, Coolify proxy, Coolify

Ce serveur est suffisant pour les premiers clients et les tests reels. Pour plus de trafic, surveiller CPU, RAM, disque, connexions PostgreSQL et temps de reponse API.

## Capacite prudente

Sans test de charge officiel :

- 150 a 300 utilisateurs connectes mais peu actifs.
- 50 a 100 utilisateurs actifs simultanes.
- 10 a 30 caissiers POS simultanes confortablement.

Ces chiffres doivent etre confirmes par un test de charge avant un lancement commercial large.

## Backups PostgreSQL

Priorite : creer une tache planifiee Coolify quotidienne.

Commande recommandee dans le serveur Coolify :

```bash
mkdir -p /data/vta-backups
docker exec ptd1k3qtd7ov04yrps5fjkjx pg_dump -U postgres -d postgres -Fc -f /tmp/vta-$(date +%F-%H%M).dump
docker cp ptd1k3qtd7ov04yrps5fjkjx:/tmp/vta-$(date +%F-%H%M).dump /data/vta-backups/
find /data/vta-backups -type f -name "vta-*.dump" -mtime +14 -delete
```

Regle minimale :

- 1 backup par jour.
- Conservation 14 jours.
- Tester une restauration au moins une fois par mois.

## Monitoring

A activer dans Coolify :

- Server > Metrics > Enable Metrics
- Alertes disque si utilisation > 80 %
- Alertes RAM si utilisation > 80 %
- Alertes API si `/health/ready` echoue

## Taches planifiees recommandees

Dans Coolify > Scheduled Tasks :

- `backup-postgres-daily` : tous les jours a 02:00.
- `health-check-hourly` : toutes les heures, appeler `https://api.vtaerp.com/health/ready`.
- `cleanup-backups-weekly` : supprimer les backups de plus de 14 jours.

## Evolution serveur

Quand passer au niveau superieur :

- CPU > 70 % pendant plusieurs minutes.
- RAM disponible < 1 GiB.
- Connexions PostgreSQL proches de la limite.
- POS lent pendant les ventes.
- Dashboard ou rapports trop lents.

Prochaine architecture :

- API/Web sur serveur applicatif.
- PostgreSQL separe.
- PgBouncer entre API et PostgreSQL.
- Backups externes hors serveur.
- Monitoring externe.

# VTA Commerce - Mode hors ligne et Android

## Mode hors ligne MVP

Le POS est prepare pour fonctionner pendant une coupure internet courte apres un premier chargement en ligne.

Quand le caissier est en ligne :

- les produits du POS sont sauvegardes dans IndexedDB ;
- les clients recents, le magasin, le depot et la caisse active sont sauvegardes localement ;
- les ventes en attente sont synchronisees automatiquement quand l API revient.

Quand le caissier est hors ligne :

- le POS utilise les produits deja caches ;
- la vente est bloquee si le stock local est insuffisant ;
- la vente est enregistree localement ;
- le stock local est diminue pour eviter une double vente evidente ;
- le ticket local peut etre imprime ;
- la vente reste marquee comme en attente de synchronisation.

Quand la connexion revient :

- `POST /pos/sync-offline-sales` cree les ventes cote backend ;
- le backend reverifie le tenant, l utilisateur et le stock reel ;
- la vente, le paiement et le mouvement de stock sont crees dans une transaction Prisma ;
- en cas de conflit, la vente locale reste visible avec le statut "Conflit a verifier".

## Limites volontairement gardees pour le MVP

- La premiere ouverture du POS doit se faire avec internet.
- Seules les donnees POS deja chargees sont disponibles hors ligne.
- La synchronisation avancee multi-appareils sera traitee dans un sprint dedie.
- Les modules achats, rapports et parametres ne sont pas encore completement offline.

## Android - Option B

L option B transforme VTA Commerce en application Android via Capacitor avec l URL de production `https://vtaerp.com`.

Cette approche garde :

- le meme frontend Next.js ;
- le meme backend API ;
- les memes deploiements Coolify ;
- le mode PWA/offline du navigateur integre.

## Commandes Android

Depuis la racine du depot :

```bash
npm install
npm run mobile:add:android --workspace=@vta/web
npm run mobile:sync --workspace=@vta/web
npm run mobile:open --workspace=@vta/web
```

Dans Android Studio :

- verifier le nom de l application ;
- configurer l icone finale ;
- generer une cle de signature ;
- creer un build release AAB ;
- publier dans Google Play Console.

## Configuration Capacitor

Le fichier `apps/web/capacitor.config.ts` utilise :

- `appId`: `com.vtaerp.commerce`
- `appName`: `VTA Commerce`
- `server.url`: `https://vtaerp.com`

Pour une application totalement embarquee plus tard, il faudra adapter Next.js en export statique ou construire une version mobile dediee.

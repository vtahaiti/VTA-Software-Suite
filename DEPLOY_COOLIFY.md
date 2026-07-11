# Deploiement Coolify - VTA Software Suite

Ce projet est un monorepo npm workspaces :

- `apps/web` : frontend Next.js, port `3000`
- `apps/api` : backend NestJS, port `3001`
- `database/prisma` : schema et migrations Prisma
- `packages/*` : packages partages

## Option recommandee : deux applications Coolify

Creer deux applications separees dans Coolify, avec la meme branche Git.

### Frontend Web

- Type : Dockerfile
- Base directory : racine du depot
- Dockerfile location : `apps/web/Dockerfile`
- Port expose : `3000`
- Healthcheck HTTP recommande : `/login`
- Domaine recommande : `https://commerce.votre-domaine.com`

Variables :

```env
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
NEXT_PUBLIC_API_URL=https://api.votre-domaine.com
```

### Backend API

- Type : Dockerfile
- Base directory : racine du depot
- Dockerfile location : `apps/api/Dockerfile`
- Port expose : `3001`
- Healthcheck HTTP recommande : `/health`
- Domaine recommande : `https://api.votre-domaine.com`

Variables :

```env
NODE_ENV=production
API_PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
JWT_SECRET=remplacer-par-un-secret-long
JWT_REFRESH_SECRET=remplacer-par-un-autre-secret-long
WEB_URL=https://commerce.votre-domaine.com
```

Le conteneur API execute automatiquement :

```bash
npx prisma migrate deploy --schema=database/prisma/schema.prisma
npm run start --workspace=@vta/api
```

### Email transactionnel / mot de passe oubli?

Le backend utilise SMTP via Nodemailer pour envoyer les liens de r?initialisation. Aucune cl? ne doit ?tre commit?e dans Git.

Variables API ? configurer dans Coolify :

```env
PASSWORD_RESET_BASE_URL=https://vtaerp.com/reset-password
PASSWORD_RESET_ALLOWED_HOSTS=vtaerp.com,www.vtaerp.com
SMTP_HOST=smtp.votre-fournisseur.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=utilisateur-smtp
SMTP_PASSWORD=mot-de-passe-ou-cle-smtp
SMTP_FROM=VTA Commerce <noreply@vtaerp.com>
```

Le domaine exp?diteur doit ?tre autoris? chez le fournisseur email et disposer de SPF, DKIM et DMARC valides. Apr?s modification des variables, red?marrer l'application API.

## Base PostgreSQL

Utiliser une base PostgreSQL Coolify ou externe.

Valeurs conseillees :

- PostgreSQL : `16`
- Database : `vta_commerce`
- Port interne : `5432`
- SSL : selon la configuration Coolify

La variable importante est :

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/vta_commerce?schema=public
```

## Option alternative : Docker Compose production

Le fichier `docker-compose.production.yml` permet de lancer Web, API et PostgreSQL ensemble.

Coolify peut aussi importer ce compose si vous voulez une seule stack.

Variables minimales :

```env
POSTGRES_DB=vta_commerce
POSTGRES_USER=vta
POSTGRES_PASSWORD=vta_password
DATABASE_URL=postgresql://vta:vta_password@postgres:5432/vta_commerce?schema=public
JWT_SECRET=remplacer-par-un-secret-long
JWT_REFRESH_SECRET=remplacer-par-un-autre-secret-long
WEB_URL=https://commerce.votre-domaine.com
NEXT_PUBLIC_API_URL=https://api.votre-domaine.com
```

Ports :

- Web : `3000`
- API : `3001`
- PostgreSQL : `5432` en interne

## Commandes locales utiles

```bash
npm install
npm run build
npm run start:api
npm run start:web
```

## Points de controle apres deploiement

Verifier :

- API : `https://api.votre-domaine.com/health`
- Web : `https://commerce.votre-domaine.com/login`
- CORS API : `WEB_URL` doit correspondre au domaine Web
- Frontend : `NEXT_PUBLIC_API_URL` doit correspondre au domaine API
- Prisma : les migrations doivent passer au demarrage de l'API

## Notes importantes

- Ne pas utiliser `localhost` dans les variables de production Coolify.
- `NEXT_PUBLIC_API_URL` est injectee au build du frontend. Si le domaine API change, reconstruire le frontend.
- `JWT_SECRET` et `JWT_REFRESH_SECRET` doivent etre longs et differents.
- Les uploads API sont stockes dans `/app/uploads`; avec le compose production, un volume persistant est monte.

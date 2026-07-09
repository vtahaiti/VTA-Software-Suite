# VTA Software Suite

VTA Commerce est le premier produit de VTA Software Suite. Cette fondation met en place un monorepo npm workspaces avec un frontend Next.js, une API NestJS, PostgreSQL et Prisma.

## Prerequis

Installez Node.js 20 LTS ou une version plus recente depuis le site officiel : https://nodejs.org/

Verifiez ensuite l'installation :

```bash
node --version
npm --version
```

Installez aussi Docker Desktop pour lancer PostgreSQL localement.

## Installation

Depuis la racine du depot :

```bash
npm install
```

Copiez les variables d'environnement :

```bash
cp .env.example .env
```

Avec PowerShell :

```powershell
Copy-Item .env.example .env
```

## Demarrer PostgreSQL

```bash
docker compose up -d
```

## Generer Prisma

```bash
npm run prisma:generate
```

Pour creer une migration locale plus tard :

```bash
npm run prisma:migrate
```

## Lancer l'API

```bash
npm run dev:api
```

L'API demarre sur `http://localhost:3001`.

Verification :

```bash
curl http://localhost:3001/health
```

Reponse attendue :

```json
{ "status": "ok", "service": "vta-commerce-api" }
```

## Lancer le frontend

```bash
npm run dev:web
```

Le frontend demarre sur `http://localhost:3000`.

Pages disponibles :

- Accueil : `http://localhost:3000`
- Connexion : `http://localhost:3000/login`
- Tableau de bord : `http://localhost:3000/dashboard`

## Commandes utiles

```bash
npm install
docker compose up -d
npm run prisma:generate
npm run dev:api
npm run dev:web
```

## Demarrage local VTA ERP

Utilisez ces commandes pour tester VTA ERP en local de facon stable :

```powershell
npm run local:start
npm run local:stop
npm run local:check
```

`npm run local:start` verifie PostgreSQL, libere les ports `3000` et `3001` si un ancien processus Node du projet les utilise, lance l'API, lance le frontend, puis ouvre automatiquement :

```text
http://localhost:3000/login
```

Pour verifier l'etat local sans relancer les serveurs :

```powershell
npm run local:check
```

Pour tout arreter proprement :

```powershell
npm run local:stop
```

Important : ne lancez pas plusieurs fois `npm run dev:web` ou `npm run dev:api` dans des terminaux differents. Cela peut provoquer `EADDRINUSE` si les ports `3000` ou `3001` sont deja occupes. Utilisez plutot `npm run local:start` pour eviter les conflits.

Double-clic Windows : vous pouvez aussi lancer `VTA-ERP-START.bat` a la racine du projet.

Page de diagnostic local :

```text
http://localhost:3000/local-status
```
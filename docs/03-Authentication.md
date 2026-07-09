# Authentication

## Objectif

Le système d'authentification permet aux utilisateurs de se connecter à VTA Software Suite de manière sécurisée.

Il doit gérer :

- Création de compte
- Connexion
- Déconnexion
- Sessions
- Mot de passe oublié
- Changement de mot de passe
- Invitations d'employés
- Accès à une ou plusieurs entreprises

---

## Principe principal

Un utilisateur peut appartenir à une ou plusieurs entreprises.

Après connexion, le système doit déterminer à quelles entreprises l'utilisateur a accès.

Si l'utilisateur appartient à plusieurs entreprises, il devra choisir l'entreprise active.

---

## Sécurité

Le système utilisera :

- Email + mot de passe
- JWT Access Token
- Refresh Token
- Mot de passe chiffré
- Vérification des permissions
- Sessions sécurisées
- Double authentification dans une future version

---

## Règle obligatoire

Aucune action ne doit être exécutée sans vérifier :

1. L'identité de l'utilisateur.
2. Le Tenant actif.
3. Les permissions de l'utilisateur.
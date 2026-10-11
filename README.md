# OnlyBudget

Application interne de suivi des ventes, dépenses et trésorerie pour l'agence : suivi des gains par chatteur, dépenses, comptes/"maisons d'argent" avec retraits et frais automatiques, historique complet, et partage du bénéfice net entre associés.

## Démarrage

Prérequis : [Node.js](https://nodejs.org/) 20+, un projet [Neon](https://neon.com) (Postgres gratuit) et un store [Vercel Blob](https://vercel.com/docs/vercel-blob) (stockage des logos, gratuit) — voir [Déploiement en ligne](#déploiement-en-ligne-vercel--neon--blob) pour les créer.

```bash
npm install
# renseignez DATABASE_URL, DIRECT_URL, JWT_SECRET et BLOB_READ_WRITE_TOKEN dans .env (voir .env.example)
npx prisma migrate dev
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

### Compte de départ

Un seul compte associé est créé automatiquement, avec un mot de passe généré aléatoirement et affiché **une seule fois** dans le terminal juste après `prisma migrate dev` / `prisma db seed` :

- **Email** : `admin@onlybudget.local`
- **Mot de passe** : voir la sortie du terminal (bloc encadré `====`)

Notez-le, changez-le dès la première connexion (page *Profil*), puis ajoutez votre second associé et vos chatteurs depuis la page *Équipe*.

## À configurer avant utilisation réelle

1. **Paramètres → Devises** : les taux EUR→Ar et USD→Ar de départ sont des valeurs provisoires. Mettez-les à jour avec les taux réels.
2. **Paramètres → Comptes** : ajustez ou complétez les comptes de départ (OnlyChat, PayPal, Binance, Banque, Mvola) — nom, logo, devise.
3. **Trésorerie → Chemins de retrait** : les chemins entre comptes sont créés à 0% de frais. Configurez le vrai pourcentage ou montant fixe de chaque retrait (ex : Binance → Banque, Banque → Mvola).
4. **Équipe** : ajoutez votre second associé (et ajustez le % de part du bénéfice de chacun — la somme doit faire 100%) et vos chatteurs.

## Fonctionnement

- **Chatteur** : ajoute uniquement ses propres gains du jour, et voit son propre historique/graphique.
- **Associé** : accès complet — gains (pour tous), dépenses, trésorerie (comptes, retraits, frais), historique complet, gestion de l'équipe, devises et catégories.
- **Bénéfice net** = total des gains − total des dépenses, recalculé en temps réel et réparti entre associés selon leur pourcentage.
- **Retraits** : un chemin de retrait relie deux comptes avec un frais (aucun / %, / montant fixe) ; confirmer un retrait diminue le compte source et augmente le compte destination du montant net, en convertissant automatiquement de devise si besoin.
- **Historique** : journal unique de tous les gains, dépenses et retraits, avec qui a fait quoi et quand.

## Sauvegarde

Toutes les données vivent dans votre projet Neon (Postgres). Neon garde un historique de sauvegardes automatique ; pour une copie manuelle, utilisez `pg_dump` avec votre `DIRECT_URL`, ou l'onglet *Backups* du tableau de bord Neon.

## Déploiement en ligne (Vercel + Neon + Blob)

Stack 100% gratuite pour ce niveau d'usage : [Vercel](https://vercel.com) héberge l'app, [Neon](https://neon.com) fournit la base de données Postgres, [Vercel Blob](https://vercel.com/docs/vercel-blob) stocke les logos importés.

### 1. Créer la base de données (Neon)

1. Créez un compte sur [neon.com](https://neon.com) et un nouveau projet.
2. Dans le tableau de bord du projet, onglet **Connection Details** : copiez la chaîne de connexion **pooled** (avec `-pooler` dans l'adresse) → c'est votre `DATABASE_URL`. Copiez aussi la chaîne **direct** (sans `-pooler`) → c'est votre `DIRECT_URL`.

### 2. Créer le compte Vercel + le store Blob

1. Créez un compte sur [vercel.com](https://vercel.com).
2. Tableau de bord → **Storage** → **Create Database** → **Blob** → choisissez l'accès **Public**.

### 3. Déployer

```bash
npm install -g vercel
vercel login
vercel link          # crée/lie le projet Vercel depuis ce dossier
```

Connectez le store Blob à ce projet : tableau de bord Vercel → **Storage** → votre store → **Projects** → **Connect to Project** → sélectionnez ce projet.

Dans le tableau de bord Vercel du projet → **Settings → Environment Variables**, ajoutez :

- `DATABASE_URL` et `DIRECT_URL` (récupérées à l'étape 1)
- `JWT_SECRET` : une longue chaîne aléatoire, différente de celle utilisée en local (générez-en une avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

(`BLOB_READ_WRITE_TOKEN` n'est pas nécessaire ici : une fois le store Blob connecté au projet, Vercel gère l'accès automatiquement.)

Puis déployez :

```bash
vercel --prod
```

Récupérez le mot de passe généré du compte admin dans les logs du build (tableau de bord Vercel → Deployments → le déploiement → Build Logs), affiché une seule fois lors du tout premier démarrage.

Vercel fournit une URL publique en HTTPS automatiquement (`*.vercel.app`). Un nom de domaine personnalisé peut être ajouté depuis *Settings → Domains*.

Pour les déploiements suivants, relancez `vercel --prod` (ou connectez le projet à un dépôt GitHub depuis le tableau de bord pour un déploiement automatique à chaque `git push`).

**À savoir** : Neon met sa base en veille après une période d'inactivité (offre gratuite) ; la toute première requête après une pause peut prendre quelques secondes de plus le temps qu'elle se réveille — c'est normal.

## Stack technique

Next.js (App Router) · TypeScript · Prisma + Postgres (Neon) · Vercel Blob · Tailwind CSS · Recharts

## Scripts

```bash
npm run dev      # serveur de développement
npm run build    # migrations + seed + build de production (utilisé par Vercel)
npm run start    # lancer le build de production
npx prisma studio # explorer/modifier la base de données visuellement
```

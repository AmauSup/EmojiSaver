# EmoteVault

EmoteVault est une extension navigateur permettant de sauvegarder, organiser et réutiliser des emojis personnalisés Discord.

Le projet repose sur :
- une extension WebExtension (Manifest V3)
- un backend Node.js / Express
- une base PostgreSQL hébergée sur Neon

## Fonctionnalités

- Sauvegarde d’emojis Discord personnalisés (via clic droit ou auto-save)
- Menu contextuel “Save to EmoteVault” et “Copy Discord format”
- Détection automatique des emojis visibles (MutationObserver)
- Recherche, filtrage par serveur, tri (date, nom, serveur)
- Gestion des favoris et sélection multiple
- Détection des emojis animés (GIF)
- Association des emojis à leur serveur d’origine
- Discord Emoji Builder (prévisualisation par ID)
- Gestion du compte utilisateur (nom d’utilisateur, mot de passe)

## Architecture

```text
Discord Web
↓
Extension navigateur (WebExtension)
↓
API REST Express.js
↓
PostgreSQL (Neon)
```

## Structure du projet

```text
/backend      → API Node.js / Express
/extension    → Extension navigateur Manifest V3
```

## Technologies utilisées

### Backend
- Node.js
- Express.js
- PostgreSQL
- pg
- bcryptjs
- cors
- dotenv

### Extension
- JavaScript Vanilla
- WebExtension Manifest V3
- chrome.storage.local
- MutationObserver

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/AmauSup/EmojiSaver.git
cd EmojiSaver
```

### 2. Installer le backend

```bash
cd backend
npm install
cp .env.example .env   # Linux/Mac
copy .env.example .env # Windows
```

Configurer ensuite le fichier `.env` :

```env
PGHOST=your_host
PGDATABASE=your_database
PGUSER=your_user
PGPASSWORD=your_password
PGPORT=5432
PORT=3000
```

### 3. Lancer le backend

```bash
npm run dev
```

Le serveur démarre sur :

```text
http://localhost:3000
```

### 4. Installer l’extension

- Ouvrir Chrome / Edge / Brave
- Aller dans `Extensions`
- Activer le mode développeur
- “Charger l’extension non empaquetée”
- Sélectionner le dossier `/extension`

## Fonctionnement

L’extension détecte les emojis Discord visibles directement dans le DOM de Discord Web.

Les données sont ensuite envoyées au backend Express puis stockées dans PostgreSQL.

## Limitations actuelles

- Pas encore de Docker
- Pas de tests automatisés
- Authentification simplifiée
- Projet non publié sur le Chrome Web Store

## Améliorations futures

- Dockerisation
- Tests unitaires et E2E
- Authentification JWT
- CI/CD
- Publication Chrome Web Store

## Contribution

Projet réalisé dans un cadre personnel et collaboratif.

Contributeurs :
- https://github.com/AmauSup
- https://github.com/v2bejarry
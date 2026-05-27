# EmoteVault

Extension navigateur pour sauvegarder, organiser et réutiliser les emojis personnalisés Discord.

## Problème résolu

Discord ne permet pas d'exporter ni de retrouver facilement ses emojis favoris entre serveurs. EmoteVault comble ce manque : l'extension détecte automatiquement les emojis visibles sur Discord Web, les associe à leur serveur d'origine et les stocke dans une base de données personnelle.

## Fonctionnalités principales

- **Auto-save** — détection automatique des emojis visibles via MutationObserver (toutes les 3,5 s)
- **Clic droit** — menu contextuel "Save to EmoteVault" et "Copy Discord format"
- **Bibliothèque** — recherche par nom, filtre par serveur, tri (date, A→Z, serveur), favoris
- **Emojis animés** — détection et affichage des GIFs Discord
- **Discord Emoji Builder** — prévisualisation d'un emoji par ID/nom sans naviguer sur le serveur
- **Gestion du compte** — création, connexion, modification du nom d'utilisateur et du mot de passe
- **Sélection multiple** — suppression en masse

## Stack technique

| Couche | Technologies |
|--------|-------------|
| Extension | JavaScript Vanilla, WebExtension Manifest V3, chrome.storage.local |
| Backend | Node.js, Express.js, bcryptjs, cors, dotenv |
| Base de données | PostgreSQL (Neon), pg |

## Architecture

```
Discord Web (navigateur)
        │  DOM events, images CDN
        ▼
content.js — MutationObserver, parsing markdown <:name:id>
        │  messages chrome.runtime
        ▼
background.js — service worker, menu contextuel, relay API
        │  fetch HTTP
        ▼
API REST Express.js (localhost:3000)
        │  pg Pool
        ▼
PostgreSQL — Neon (cloud) ou instance locale
```

## Structure du projet

```
EmojiSaver/
├── backend/
│   ├── server.js        # API Express, toutes les routes
│   ├── db.js            # Pool de connexion PostgreSQL
│   ├── schema.sql       # Définition des tables (users, assets)
│   ├── .env.example     # Template des variables d'environnement
│   └── package.json
└── extension/
    ├── manifest.json    # Configuration WebExtension Manifest V3
    ├── background.js    # Service worker (menu contextuel, appels API)
    ├── content.js       # Script injecté dans Discord Web
    ├── popup.js         # Logique de l'interface utilisateur
    ├── popup.html       # Interface popup
    ├── popup.css        # Styles
    └── package.json
```

## Installation

### Prérequis

- Node.js >= 18
- Une base PostgreSQL (locale ou [Neon](https://neon.tech))
- Chrome, Edge ou Brave

### 1. Cloner le projet

```bash
git clone https://github.com/AmauSup/EmojiSaver.git
cd EmojiSaver
```

### 2. Configurer et lancer le backend

```bash
cd backend
npm install
```

Copier le template et renseigner vos valeurs :

```bash
# Linux/Mac
cp .env.example .env

# Windows
copy .env.example .env
```

Créer les tables en base (une seule fois) :

```bash
# Avec psql
psql -U your_user -d your_database -f schema.sql
```

Lancer le serveur :

```bash
npm run dev    # développement (nodemon)
npm start      # production
```

Le backend écoute sur `http://localhost:3000`.

### 3. Installer l'extension

1. Ouvrir **Chrome / Edge / Brave**
2. Aller dans `chrome://extensions`
3. Activer le **mode développeur** (interrupteur en haut à droite)
4. Cliquer sur **"Charger l'extension non empaquetée"**
5. Sélectionner le dossier `extension/`

## Variables d'environnement

Fichier `backend/.env` (à créer depuis `.env.example`) :

```env
PGHOST=your_neon_host
PGDATABASE=your_database
PGUSER=your_user
PGPASSWORD=your_password
PGPORT=5432
PORT=3000
CORS_ORIGIN=http://localhost
```

## Démo rapide

1. Lancer le backend (`npm run dev` dans `backend/`)
2. Installer l'extension en mode développeur
3. Ouvrir Discord Web, se connecter dans le popup EmoteVault
4. Activer l'auto-save — les emojis visibles sont capturés automatiquement
5. Clic droit sur n'importe quel emoji → "Save to EmoteVault"
6. Ouvrir le popup pour rechercher, filtrer et copier vos emojis

## Limites actuelles

- Fonctionne uniquement avec Discord Web (pas l'application desktop)
- Le backend doit tourner en local — pas de déploiement cloud configuré
- Authentification simplifiée : pas de JWT, l'`user_id` est stocké dans `chrome.storage.local`
- Non publié sur le Chrome Web Store
- Pas de tests automatisés
- Pas de pagination côté serveur (tous les assets sont chargés en une requête)

## Améliorations futures

- Authentification JWT avec refresh tokens
- Dockerisation du backend
- Tests unitaires (Jest) et E2E
- Pagination serveur
- Déploiement cloud (Railway, Fly.io)
- Publication Chrome Web Store
- Support Firefox (WebExtension API compatible)

## Pourquoi ce projet est intéressant techniquement

- **Manifest V3** : adaptation aux contraintes de sécurité récentes de Chrome (service worker au lieu de background page persistante, scripting API au lieu de l'injection directe)
- **MutationObserver** : détection en temps réel des changements DOM sur une SPA React (Discord), sans accès à l'état interne de l'application
- **Scraping DOM sans API officielle** : parsing de la syntaxe markdown Discord (`<:name:id>`, `<a:name:id>`) et des URLs CDN pour reconstruire les métadonnées des emojis
- **Architecture message-passing** : communication entre content script, service worker et popup via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`
- **Prévention des doublons** : contrainte composite `(user_id, image_url)` côté base + enrichissement silencieux des métadonnées manquantes (server_id/server_name) si l'emoji existe déjà sans association serveur

## Contributeurs

- [AmauSup](https://github.com/AmauSup)
- [v2bejarry](https://github.com/v2bejarry)

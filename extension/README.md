# EmoteVault — Extension

Extension navigateur WebExtension (Manifest V3) permettant de sauvegarder et organiser les emojis personnalisés Discord.

## Fichiers principaux

### `manifest.json`

Fichier de configuration de l'extension (Manifest V3).

Déclare :
- les **permissions** : `contextMenus`, `storage`, `activeTab`, `scripting`
- les **host_permissions** : `discord.com`, `discordapp.com`, `cdn.discordapp.com`, `media.discordapp.net`
- le **service worker** : `background.js`
- le **content script** : `content.js` injecté sur toutes les pages Discord
- l'**action popup** : `popup.html`

### `background.js`

Service worker (remplace la background page persistante de Manifest V2).

Responsabilités :
- Création et gestion du **menu contextuel** (clic droit sur une image)
- Réception des messages du content script via `chrome.runtime.onMessage`
- **Relay des appels API** vers le backend Express (`http://localhost:3000`)
- Sauvegarde d'un emoji unique (`save-asset`) et d'un lot d'emojis (`save-assets-bulk`)

> Le service worker est réveillé à la demande et peut s'endormir entre deux événements — c'est une contrainte Manifest V3.

### `content.js`

Script injecté dans chaque page Discord Web.

Responsabilités :
- **Scan du DOM** : détection des images CDN Discord (`cdn.discordapp.com/emojis/`) dans les messages
- **Parsing markdown** : extraction des emojis depuis la syntaxe `<:name:id>` (statique) et `<a:name:id>` (animé)
- **Scan du sélecteur d'emojis Discord** : détection avec association au serveur d'origine
- **MutationObserver** : surveillance des changements DOM en temps réel (Discord est une SPA React — le DOM est modifié dynamiquement sans rechargement de page)
- Envoi des emojis détectés au service worker via `chrome.runtime.sendMessage`
- Réponse aux messages de polling depuis le popup (auto-save)

### `popup.js`

Logique de l'interface utilisateur (popup de l'extension).

Responsabilités :
- **Authentification** : connexion / déconnexion, persistance de la session via `chrome.storage.local`
- **Affichage de la bibliothèque** : récupération des emojis depuis le backend, rendu paginé (20 par page)
- **Recherche, filtrage, tri** : filtres appliqués côté client avant affichage
- **Auto-save** : déclenchement périodique (toutes les 3,5 s) — envoie un message au content script pour demander les emojis actuellement visibles, puis les sauve en batch
- **Discord Emoji Builder** : prévisualisation d'un emoji par ID et nom, sans naviguer sur le serveur
- **Gestion du compte** : modification du nom d'utilisateur et du mot de passe
- **Sélection multiple** : suppression en masse via des requêtes DELETE successives

## Fonctionnement du clic droit

1. L'utilisateur fait un clic droit sur une image d'emoji sur Discord Web
2. Le **menu contextuel** affiché par `background.js` propose :
   - **"Save to EmoteVault"** — appelle `POST /api/assets` avec l'URL de l'image
   - **"Copy Discord format (`<:name:id>`)"** — copie la syntaxe Discord dans le presse-papier via `chrome.scripting.executeScript`
3. Le nom et l'ID de l'emoji sont extraits depuis l'attribut `alt` ou l'URL CDN de l'image

## Fonctionnement de l'auto-save

1. L'utilisateur active l'auto-save dans le popup (interrupteur)
2. `popup.js` déclenche un intervalle toutes les **3 500 ms**
3. À chaque tick, `popup.js` envoie un message `get-page-emojis` au `content.js` de l'onglet actif
4. `content.js` scanne le DOM, extrait tous les emojis visibles et les retourne
5. `popup.js` appelle `POST /api/assets` pour chaque emoji non encore sauvegardé
6. Le backend retourne 409 pour les doublons — ils sont ignorés silencieusement

## Limites liées au scraping DOM Discord

Discord est une **SPA React** dont le DOM n'est pas prévu pour être inspecté par des tiers :

- La structure des classes CSS (ex : `alt` des images) peut changer sans préavis lors des mises à jour Discord
- Les emojis ne sont visibles dans le DOM que s'ils sont dans la zone visible (virtualisation React)
- Le sélecteur d'emojis Discord n'expose pas directement l'ID du serveur d'origine — l'association est déduite du contexte DOM environnant
- Certains emojis intégrés dans les réactions ne sont pas toujours captés (structure DOM différente)
- Aucune utilisation de l'API officielle Discord (non autorisée pour ce type d'usage)

## Stockage local (`chrome.storage.local`)

| Clé | Description |
|-----|-------------|
| `emotevault_user_id` | UUID de l'utilisateur connecté |
| `emotevault_username` | Nom d'utilisateur affiché |
| `emotevault_auto_sync_enabled` | État de l'auto-save (`true` / `false`) |

## Installation en mode développeur

1. Lancer le backend (`npm run dev` dans `backend/`)
2. Ouvrir **Chrome, Edge ou Brave**
3. Naviguer vers `chrome://extensions`
4. Activer le **mode développeur** (interrupteur en haut à droite)
5. Cliquer sur **"Charger l'extension non empaquetée"**
6. Sélectionner le dossier `extension/`
7. L'icône EmoteVault apparaît dans la barre d'extensions

Pour mettre à jour l'extension après une modification de code : cliquer sur l'icône de rechargement dans `chrome://extensions`.

## Limitations

- Fonctionne uniquement avec **Discord Web** (pas l'application desktop Electron)
- Nécessite un **backend local actif** sur `http://localhost:3000`
- `BACKEND_URL` est codé en dur dans `popup.js` et `background.js` — à externaliser pour un déploiement cloud
- Non publié sur le Chrome Web Store

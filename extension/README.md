# EmoteVault Extension
Extension navigateur WebExtension (Manifest V3) permettant de sauvegarder et organiser des emojis Discord personnalisés.
## Fichiers principaux
- `manifest.json` — configuration de l’extension (v1.0.0)
- `popup.html` / `popup.js` / `popup.css` — interface utilisateur
- `background.js` — service worker (menu contextuel, relay API)
- `content.js` — script injecté dans Discord Web
## Fonctionnalités
### Popup
- Connexion / déconnexion (username + password)
- Recherche d’emojis par nom
- Filtrage par serveur d’origine
- Tri : Recent, A→Z, Z→A, Serveur A→Z, Serveur Z→A
- Filtre favoris (étoile)
- Sélection multiple et suppression en masse
- Pagination (20 emojis par page)
- Discord Emoji Builder : saisir un ID et un nom, prévisualiser, copier le lien CDN, sauvegarder
- Auto-save : capture automatique des emojis visibles (toutes les 3,5 secondes)
- Gestion du compte : modifier le nom d’utilisateur ou le mot de passe
### Détection des emojis
- Scan du DOM à la recherche d’images CDN Discord
- Parsing de la syntaxe markdown `<:name:id>` et `<a:name:id>` (animés)
- Détection des emojis dans le sélecteur d’emojis avec association au serveur
- MutationObserver pour les changements dynamiques du DOM
### Menu contextuel (clic droit)
- “Save to EmoteVault” — sauvegarde l’emoji cliqué
- “Copy Discord format (`<:name:id>`)” — copie la syntaxe Discord
## Technologies utilisées
# EmoteVault Extension

Extension navigateur WebExtension (Manifest V3) permettant de sauvegarder et organiser des emojis Discord personnalisés.

## Fichiers principaux

- `manifest.json` — configuration de l’extension (v1.0.0)
- `popup.html` / `popup.js` / `popup.css` — interface utilisateur
- `background.js` — service worker (menu contextuel, relay API)
- `content.js` — script injecté dans Discord Web

## Fonctionnalités

### Popup

- Connexion / déconnexion (username + password)
- Recherche d’emojis par nom
- Filtrage par serveur d’origine
- Tri : Recent, A→Z, Z→A, Serveur A→Z, Serveur Z→A
- Filtre favoris (étoile)
- Sélection multiple et suppression en masse
- Pagination (20 emojis par page)
- Discord Emoji Builder : saisir un ID et un nom, prévisualiser, copier le lien CDN, sauvegarder
- Auto-save : capture automatique des emojis visibles (toutes les 3,5 secondes)
- Gestion du compte : modifier le nom d’utilisateur ou le mot de passe

### Détection des emojis

- Scan du DOM à la recherche d’images CDN Discord
- Parsing de la syntaxe markdown `<:name:id>` et `<a:name:id>` (animés)
- Détection des emojis dans le sélecteur d’emojis avec association au serveur
- MutationObserver pour les changements dynamiques du DOM

### Menu contextuel (clic droit)

- “Save to EmoteVault” — sauvegarde l’emoji cliqué
- “Copy Discord format (`<:name:id>`)” — copie la syntaxe Discord

## Technologies utilisées

- JavaScript Vanilla
- WebExtension Manifest V3
- chrome.storage.local
- MutationObserver

## Permissions

- `contextMenus`, `storage`, `activeTab`, `scripting`
- Host permissions : `discord.com`, `discordapp.com`, `media.discordapp.net`, `cdn.discordapp.com`

## Stockage local (chrome.storage.local)

| Clé | Description |
|-----|-------------|
| `emotevault_user_id` | UUID de l’utilisateur connecté |
| `emotevault_username` | Nom d’utilisateur |
| `emotevault_auto_sync_enabled` | État de l’auto-save (booléen) |

## Architecture

```text
Discord Web
↓
content.js (détection emojis, MutationObserver)
↓
background.js (service worker, menu contextuel, appels API)
↔
popup.js (interface utilisateur)
↓
Backend Express.js (http://localhost:3000)
```

## Installation

1. Lancer le backend sur `http://localhost:3000`
2. Ouvrir Chrome / Edge / Brave
3. Aller dans `Extensions`
4. Activer le mode développeur
5. Cliquer sur “Charger l’extension non empaquetée”
6. Sélectionner le dossier `/extension`

## Notes techniques

- Les emojis sont récupérés via les URLs CDN Discord publiques (`cdn.discordapp.com`)
- Pas d’utilisation de l’API officielle Discord
- `BACKEND_URL` est codé en dur à `http://localhost:3000` dans `popup.js` et `background.js`

## Limitations

- Fonctionne uniquement avec Discord Web
- Nécessite un backend local actif
- Non publié sur le Chrome Web Store
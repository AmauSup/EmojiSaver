# EmoteVault — Backend

API REST Node.js / Express pour EmoteVault.

Gère l'authentification utilisateur, la persistance des emojis, les favoris, le filtrage et le tri.

## Stack technique

- **Node.js** + **Express.js** — serveur HTTP
- **PostgreSQL** via **pg** (pool de connexions)
- **bcryptjs** — hachage des mots de passe
- **dotenv** — chargement des variables d'environnement
- **cors** — politique d'origines croisées

## Fichiers principaux

| Fichier | Rôle |
|---------|------|
| `server.js` | Point d'entrée : configuration Express, déclaration de toutes les routes |
| `db.js` | Pool de connexion PostgreSQL (singleton réutilisé par toutes les routes) |
| `schema.sql` | Définition des tables `users` et `assets` + index |

## Installation

```bash
cd backend
npm install
cp .env.example .env   # Linux/Mac
copy .env.example .env # Windows
```

Éditer `.env` avec vos valeurs (voir `.env.example`), puis créer les tables :

```bash
psql -U your_user -d your_database -f schema.sql
```

## Lancer le projet

```bash
npm run dev   # développement avec nodemon (rechargement automatique)
npm start     # production
```

Le serveur écoute sur `http://localhost:3000` (configurable via `PORT`).

## Routes

### Santé

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/health` | Vérifie que le serveur tourne — retourne `{ status: 'ok' }` |

### Utilisateurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/users` | Crée un compte ou connecte un utilisateur existant |
| `PATCH` | `/api/users/:id` | Modifie le nom d'utilisateur et/ou le mot de passe |

**POST /api/users**

Body : `{ username, password }`

- Si l'utilisateur n'existe pas → création du compte avec mot de passe haché (bcrypt, salt 10)
- Si l'utilisateur existe → vérification du mot de passe, retourne `{ user: { id, username, created_at } }`
- 401 si le mot de passe est incorrect

**PATCH /api/users/:id**

Body : `{ current_password, new_username?, new_password? }`

- Vérifie le mot de passe actuel avant toute modification
- 409 si le nouveau nom d'utilisateur est déjà pris
- Retourne l'utilisateur mis à jour (sans `password_hash`)

### Assets (emojis)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/assets` | Récupère les emojis de l'utilisateur avec filtres optionnels |
| `POST` | `/api/assets` | Sauvegarde un nouvel emoji |
| `PATCH` | `/api/assets/:id` | Modifie les métadonnées d'un emoji (nom, favori) |
| `DELETE` | `/api/assets/:id` | Supprime un emoji |

**GET /api/assets** — query params :

| Paramètre | Requis | Description |
|-----------|--------|-------------|
| `user_id` | oui | UUID de l'utilisateur |
| `platform` | non | Filtrer par plateforme (`discord`, `twitch`, etc.) |
| `is_favorite` | non | `true` ou `false` |
| `server_id` | non | Filtrer par serveur Discord |
| `sort` | non | `recent` (défaut), `name_asc`, `name_desc`, `server_asc`, `server_desc` |

**POST /api/assets**

Body : `{ user_id, image_url, platform, name, server_id?, server_name?, is_animated?, is_favorite? }`

- 409 si l'emoji (`image_url` + `user_id`) est déjà sauvegardé, sauf si les métadonnées serveur sont manquantes — auquel cas elles sont complétées silencieusement

**PATCH /api/assets/:id**

Body : `{ name?, is_favorite? }`

**DELETE /api/assets/:id**

Aucun body requis — retourne `{ success: true }`.

## Base de données

### Table `users`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | Généré automatiquement (`gen_random_uuid()`) |
| `username` | varchar(100) unique | Nom d'utilisateur |
| `password_hash` | varchar(255) | Hash bcrypt (nullable pour comptes legacy) |
| `created_at` | timestamp | Date de création |

### Table `assets`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | Généré automatiquement |
| `user_id` | UUID FK | Référence `users.id` (cascade delete) |
| `name` | varchar(120) | Nom de l'emoji |
| `image_url` | text | URL CDN Discord |
| `platform` | varchar(50) | Plateforme source (défaut : `discord`) |
| `server_id` | varchar(64) | ID du serveur Discord d'origine (nullable) |
| `server_name` | varchar(150) | Nom du serveur (nullable) |
| `is_animated` | boolean | GIF animé |
| `is_favorite` | boolean | Marqué comme favori |
| `created_at` / `updated_at` | timestamp | Dates de création et modification |

Index : `(user_id, server_id)` pour les requêtes de filtrage fréquentes.

## Points d'amélioration connus

- Authentification JWT (actuellement l'`user_id` est géré côté client)
- Rate limiting sur les routes sensibles
- Validation avancée des entrées (ex : format UUID)
- Pagination serveur (actuellement tous les assets sont retournés en une requête)
- Tests automatisés
- Docker

# EmoteVault Backend
Backend REST API pour EmoteVault.
Le backend gère :
- l’authentification utilisateur (création de compte + login via bcrypt)
- la sauvegarde des emojis
- les favoris
- les filtres et le tri
- la persistance PostgreSQL
## Stack technique
- Node.js
- Express.js
- PostgreSQL
- pg
- bcryptjs
- dotenv
- cors
## Fichiers principaux
- `server.js` — point d’entrée, configuration Express et routes
- `db.js` — pool de connexion PostgreSQL
- `schema.sql` — définition des tables
## Installation
```bash
cd backend
npm install
cp .env.example .env
Configurer ensuite les variables d’environnement :
```env
PGHOST=your_host
PGDATABASE=your_database
# EmoteVault Backend

Backend REST API pour EmoteVault.

Le backend gère :
- l’authentification utilisateur (création de compte + login via bcrypt)
- la sauvegarde des emojis
- les favoris
- les filtres et le tri
- la persistance PostgreSQL

## Stack technique

- Node.js
- Express.js
- PostgreSQL
- pg
- bcryptjs
- dotenv
- cors

## Fichiers principaux

- `server.js` — point d’entrée, configuration Express et routes
- `db.js` — pool de connexion PostgreSQL
- `schema.sql` — définition des tables

## Installation

```bash
cd backend
npm install
cp .env.example .env
```

Configurer ensuite les variables d’environnement :

```env
PGHOST=your_host
PGDATABASE=your_database
PGUSER=your_user
PGPASSWORD=your_password
PGPORT=5432
PORT=3000
```

## Lancer le projet

### Développement

```bash
npm run dev
```

### Production

```bash
npm start
```

Le backend démarre sur :

```text
http://localhost:3000
```

## Routes

### Santé

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/health` | Vérifie que le serveur tourne |

### Utilisateurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/users` | Crée un utilisateur ou connecte un existant |
| `PATCH` | `/api/users/:id` | Modifie le nom d’utilisateur ou le mot de passe |

**POST /api/users** — body : `{ username, password }`  
Crée le compte si inexistant, vérifie le mot de passe sinon. Retourne `{ user: { id, username, ... } }`.

**PATCH /api/users/:id** — body : `{ current_password, new_username?, new_password? }`  
Nécessite la vérification du mot de passe actuel.

### Assets (emojis)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/assets` | Récupère les emojis de l’utilisateur |
| `POST` | `/api/assets` | Sauvegarde un nouvel emoji |
| `PATCH` | `/api/assets/:id` | Modifie les métadonnées d’un emoji |
| `DELETE` | `/api/assets/:id` | Supprime un emoji |

**GET /api/assets** — query params :
- `user_id` (requis)
- `platform` (optionnel)
- `is_favorite` (optionnel : `true` / `false`)
- `server_id` (optionnel)
- `sort` (optionnel : `recent`, `name_asc`, `name_desc`, `server_asc`, `server_desc`)

**POST /api/assets** — body : `{ user_id, image_url, platform, name, server_id?, server_name?, is_animated?, is_favorite? }`  
Retourne 409 si l’URL est déjà sauvegardée pour cet utilisateur.

**PATCH /api/assets/:id** — body : `{ name?, is_favorite? }`

## Base de données

Le projet utilise PostgreSQL avec deux tables :

**users**
- `id` UUID (PK)
- `username` (unique)
- `password_hash`
- `created_at`

**assets**
- `id` UUID (PK)
- `user_id` UUID (FK → users)
- `name`, `image_url`, `platform`
- `server_id`, `server_name`
- `is_animated`, `is_favorite`
- `created_at`, `updated_at`

## Fonctionnalités

- API REST CRUD complète
- Prévention des doublons (par `image_url` + `user_id`)
- Hash des mots de passe avec bcrypt
- Gestion des favoris
- Filtrage par serveur, plateforme, favori
- Tri côté serveur (date, nom, serveur)

## Points d’amélioration

- JWT / middleware d’authentification
- Docker
- Tests automatisés
- Pagination serveur
- Validation avancée
- Rate limiting
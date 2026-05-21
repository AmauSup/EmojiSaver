# EmoteVault Backend (MVP)

API REST pour l’extension EmoteVault : sauvegarde d’assets (emojis, emotes, GIFs, images) depuis Discord, Twitch, YouTube, Reddit, ou tout site web.


## Installation

```bash
cd backend
cp .env.example .env
# Ouvre .env et colle tes infos Neon :
# Exemple :
PGHOST=ep-sweet-forest-alu50o8e-pooler.c-3.eu-central-1.aws.neon.tech
PGDATABASE=neondb
PGUSER=neondb_owner
PGPASSWORD=npg_1gUxmbDwBT7j
PGPORT=5432
PORT=3000
CORS_ORIGIN=http://localhost
```

**Astuce** :
Pour remplir .env à partir de l’URL Neon :
postgresql://neondb_owner:npg_1gUxmbDwBT7j@ep-sweet-forest-alu50o8e-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

| Champ      | Valeur extraite de l’URL |
|------------|-------------------------|
| PGHOST     | ep-sweet-forest-alu50o8e-pooler.c-3.eu-central-1.aws.neon.tech |
| PGDATABASE | neondb                  |
| PGUSER     | neondb_owner            |
| PGPASSWORD | npg_1gUxmbDwBT7j        |
| PGPORT     | 5432                    |

### Lancer le serveur en dev
```bash
npm run dev
```

### Lancer le serveur en prod
```bash
npm start
```

Le backend écoute sur http://localhost:3000

---

## Lancer l’extension EmoteVault

1. Ouvre Chrome/Edge/Brave → Extensions → Mode développeur → Charger l’extension non empaquetée → sélectionne le dossier `/extension`.
2. Vérifie que le backend tourne sur http://localhost:3000.
3. Va sur Discord, Twitch, YouTube, Reddit ou tout site web, fais clic droit sur une image/emoji/emote/gif → “Save to EmoteVault”.
4. Clique sur l’icône de l’extension pour ouvrir la popup et gérer tes assets.

## Schéma SQL recommandé

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT
);

CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  image_url TEXT NOT NULL,
  page_url TEXT,
  platform TEXT,
  asset_type TEXT,
  name TEXT DEFAULT 'unknown',
  is_animated BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE asset_tags (
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

INSERT INTO users (id, username) VALUES ('demo-user-123', 'Démo');
```

## Variables d’environnement
Voir `.env.example`.

## Routes principales
- GET /api/health
- GET /api/assets
- POST /api/assets
- PATCH /api/assets/:id
- DELETE /api/assets/:id
- GET /api/tags
- POST /api/tags

## Notes
- CORS activé pour le développement
- Pas d’auth obligatoire (user_id fixe)
- Empêche les doublons d’URL pour un même user
- Code commenté et gestion d’erreurs propre

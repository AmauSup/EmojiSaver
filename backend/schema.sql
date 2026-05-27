-- Schema EmoteVault

-- uuid-ossp fournit uuid_generate_v4() pour les clés primaires UUID.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des utilisateurs.
-- password_hash est nullable pour compatibilité avec les anciens comptes sans mot de passe.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar(100) NOT NULL,
  password_hash varchar(255),
  created_at timestamp DEFAULT now()
);

-- Index unique sur username : utilisé pour les lookups de connexion et la contrainte d'unicité.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Table des emojis sauvegardés (assets).
-- ON DELETE CASCADE : si l'utilisateur est supprimé, tous ses assets le sont aussi.
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  image_url text NOT NULL,
  platform varchar(50) NOT NULL DEFAULT 'discord',
  server_id varchar(64),
  server_name varchar(150),
  is_animated boolean DEFAULT false,
  is_favorite boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Index composite pour accélérer les requêtes filtrées par utilisateur + serveur d'origine.
CREATE INDEX IF NOT EXISTS idx_assets_user_server ON assets(user_id, server_id);

-- Schéma SQL EmoteVault (version UUID, users, assets, tags, asset_tags)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar(100) NOT NULL,
  email varchar(255) UNIQUE,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  image_url text NOT NULL,
  page_url text,
  platform varchar(50) NOT NULL,
  asset_type varchar(50) NOT NULL,
  is_animated boolean DEFAULT false,
  is_favorite boolean DEFAULT false,
  source_id varchar(100),
  source_metadata jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_tags (
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(asset_id, tag_id)
);

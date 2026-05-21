-- Schema EmoteVault
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar(100) NOT NULL,
  password_hash varchar(255),
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

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

CREATE INDEX IF NOT EXISTS idx_assets_user_server ON assets(user_id, server_id);

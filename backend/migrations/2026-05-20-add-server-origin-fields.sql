-- Ajout des colonnes pour stocker l'origine serveur Discord
ALTER TABLE assets ADD COLUMN IF NOT EXISTS server_id varchar(64);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS server_name varchar(150);

-- Index utile pour filtrer/ordonner par serveur
CREATE INDEX IF NOT EXISTS idx_assets_user_server ON assets(user_id, server_id);

-- Ajout des colonnes pour emojis Discord custom
ALTER TABLE assets ADD COLUMN IF NOT EXISTS emoji_id varchar(32);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS emoji_name varchar(120);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS discord_format varchar(150);
-- Optionnel : index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_assets_emoji_id ON assets(emoji_id);
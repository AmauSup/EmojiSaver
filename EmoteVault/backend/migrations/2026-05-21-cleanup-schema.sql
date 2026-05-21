-- Drop unused tables
DROP TABLE IF EXISTS asset_tags;
DROP TABLE IF EXISTS tags;

-- Drop unused columns from users
ALTER TABLE users DROP COLUMN IF EXISTS email;

-- Drop unused columns from assets
ALTER TABLE assets DROP COLUMN IF EXISTS page_url;
ALTER TABLE assets DROP COLUMN IF EXISTS asset_type;
ALTER TABLE assets DROP COLUMN IF EXISTS source_id;
ALTER TABLE assets DROP COLUMN IF EXISTS source_metadata;

-- Unique username constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

// db.js — Pool de connexion PostgreSQL partagé par toutes les routes.
// pg lit automatiquement PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT depuis process.env.
require('dotenv').config();
const { Pool } = require('pg');

// SSL requis par Neon (cloud PostgreSQL) ; rejectUnauthorized: false accepte
// le certificat auto-signé du pooler sans avoir à le distribuer dans le projet.
const pool = new Pool({
  ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

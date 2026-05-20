// server.js - API REST EmoteVault

process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', function (reason, promise) {
  console.error('Unhandled Rejection:', reason);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Helper: get user by email or username
async function getUser({ email, username }) {
  if (email) {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length > 0) return rows[0];
  }
  if (username) {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length > 0) return rows[0];
  }
  return null;
}

// POST /api/users/signup (ou login)
app.post('/api/users', async (req, res) => {
  const { email, username } = req.body;
  if (!email && !username) return res.status(400).json({ error: 'email ou username requis' });
  try {
    let user = await getUser({ email, username });
    if (user) return res.json({ user });
    // Créer user
    const { rows } = await db.query(
      'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
      [username || email, email || null]
    );
    user = rows[0];
    res.status(201).json({ user });
  }  catch (err) {
  console.error('POST /api/users error:', err);
  res.status(500).json({ error: 'Erreur serveur.' });
}
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});


// GET /api/assets
app.get('/api/assets', async (req, res) => {
  const user_id = req.query.user_id || 'demo-user-123';
  const platform = req.query.platform;
  const is_favorite = req.query.is_favorite;
  let query = 'SELECT * FROM assets WHERE user_id = $1';
  const params = [user_id];
  if (platform) {
    query += ' AND platform = $2';
    params.push(platform);
  }
  if (is_favorite !== undefined) {
    query += platform ? ' AND is_favorite = $3' : ' AND is_favorite = $2';
    params.push(is_favorite === 'true');
  }
  query += ' ORDER BY id DESC';
  try {
    const { rows } = await db.query(query, params);
    res.json({ assets: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/assets
app.post('/api/assets', async (req, res) => {
  const { user_id, image_url, page_url, platform, asset_type, name, is_animated, is_favorite, source_id, source_metadata } = req.body;
  if (!user_id || !image_url || !platform || !asset_type || !name) {
    return res.status(400).json({ error: 'user_id, image_url, platform, asset_type, name requis.' });
  }
  try {
    // Empêcher les doublons pour ce user
    const exists = await db.query(
      `SELECT id FROM assets WHERE user_id = $1 AND image_url = $2`,
      [user_id, image_url]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Déjà enregistré.' });
    }
    const { rows } = await db.query(
      `INSERT INTO assets (user_id, image_url, page_url, platform, asset_type, name, is_animated, is_favorite, source_id, source_metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [user_id, image_url, page_url, platform, asset_type, name, !!is_animated, !!is_favorite, source_id || null, source_metadata || null]
    );
    res.status(201).json({ asset: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PATCH /api/assets/:id (favori, nom, etc)
app.patch('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  const { name, is_favorite } = req.body;
  if (name === undefined && is_favorite === undefined) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
  }
  let set = [];
  let params = [];
  if (name !== undefined) {
    set.push('name = $' + (set.length + 1));
    params.push(name);
  }
  if (is_favorite !== undefined) {
    set.push('is_favorite = $' + (set.length + 1));
    params.push(!!is_favorite);
  }
  params.push(id);
  try {
    const { rows } = await db.query(
      `UPDATE assets SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Asset non trouvé.' });
    res.json({ asset: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/assets/:id
app.delete('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM assets WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/tags
app.get('/api/tags', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM tags ORDER BY name ASC');
    res.json({ tags: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/tags
app.post('/api/tags', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const exists = await db.query('SELECT id FROM tags WHERE name = $1', [name]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Tag déjà existant.' });
    }
    const { rows } = await db.query('INSERT INTO tags (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json({ tag: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.listen(PORT, () => {
  console.log(`EmoteVault backend running on port ${PORT}`);
});

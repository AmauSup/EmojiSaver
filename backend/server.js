// server.js — Point d'entrée de l'API REST EmoteVault.
// Gère : authentification (création/login bcrypt), CRUD emojis, filtrage et tri.
// TODO: remplacer l'auth par JWT avec middleware (actuellement user_id géré côté client)
// TODO: ajouter rate limiting (ex : express-rate-limit) sur les routes sensibles
// TODO: dockeriser le backend
// TODO: ajouter tests (Jest + Supertest)

process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', function (reason, promise) {
  console.error('Unhandled Rejection:', reason);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost';

// Ne pas exposer la version d'Express dans les headers de réponse.
app.disable('x-powered-by');

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Retourne l'utilisateur sans password_hash — ne jamais exposer le hash en réponse API.
function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

async function getUserByUsername(username) {
  const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] || null;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/users — create or login with password
// Crée le compte si le username n'existe pas, sinon vérifie le mot de passe (bcrypt).
app.post('/api/users', async (req, res) => {
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  if (!password) return res.status(400).json({ error: 'password required' });

  try {
    let user = await getUserByUsername(username);

    if (user) {
      if (user.password_hash) {
        // bcrypt.compare hache le mot de passe entrant et le compare au hash stocké.
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid password.' });
      } else {
        // Existing account without password — set it now (migration path)
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await db.query(
          'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *',
          [hash, user.id]
        );
        user = rows[0];
      }
      return res.json({ user: sanitizeUser(user) });
    }

    // Nouveau compte : hash avec bcrypt, salt cost 10 (bon compromis sécurité/performance).
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, hash]
    );
    res.status(201).json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    console.error('POST /api/users error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/users/:id — update username and/or password
app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { current_password, new_username, new_password } = req.body;

  if (!current_password) return res.status(400).json({ error: 'Current password required.' });
  if (!new_username && !new_password) return res.status(400).json({ error: 'Nothing to update.' });

  try {
    const { rows: found } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (found.length === 0) return res.status(404).json({ error: 'User not found.' });

    const user = found[0];
    if (user.password_hash) {
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid password.' });
    }

    // Construction dynamique du SET SQL avec indices de paramètres ($1, $2...).
    // Permet de mettre à jour username et/ou password dans une seule requête paramétrée.
    const sets = [];
    const params = [];

    if (new_username) {
      const taken = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [new_username, id]
      );
      if (taken.rows.length > 0) return res.status(409).json({ error: 'Username already taken.' });
      sets.push(`username = $${sets.length + 1}`);
      params.push(new_username);
    }

    if (new_password) {
      const hash = await bcrypt.hash(new_password, 10);
      sets.push(`password_hash = $${sets.length + 1}`);
      params.push(hash);
    }

    params.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    console.error('PATCH /api/users/:id error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/assets
// TODO: ajouter pagination serveur (LIMIT/OFFSET) — actuellement tous les assets sont retournés.
app.get('/api/assets', async (req, res) => {
  const user_id = req.query.user_id;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const platform = req.query.platform;
  const is_favorite = req.query.is_favorite;
  const server_id = req.query.server_id;
  const sort = req.query.sort || 'recent';

  // Construction dynamique du WHERE : paramIndex évite les conflits d'indices $N
  // lors de l'ajout conditionnel de filtres. Les requêtes paramétrées ($1, $2...)
  // protègent contre les injections SQL.
  let query = 'SELECT * FROM assets WHERE user_id = $1';
  const params = [user_id];
  let paramIndex = 2;

  if (platform) {
    query += ` AND platform = $${paramIndex}`;
    params.push(platform);
    paramIndex += 1;
  }

  if (is_favorite !== undefined) {
    query += ` AND is_favorite = $${paramIndex}`;
    params.push(is_favorite === 'true');
    paramIndex += 1;
  }

  if (server_id) {
    query += ` AND server_id = $${paramIndex}`;
    params.push(server_id);
  }

  if (sort === 'name_asc') {
    query += ' ORDER BY name ASC, created_at DESC';
  } else if (sort === 'name_desc') {
    query += ' ORDER BY name DESC, created_at DESC';
  } else if (sort === 'server_asc') {
    query += " ORDER BY COALESCE(server_name, '') ASC, created_at DESC";
  } else if (sort === 'server_desc') {
    query += " ORDER BY COALESCE(server_name, '') DESC, created_at DESC";
  } else {
    query += ' ORDER BY created_at DESC';
  }

  try {
    const { rows } = await db.query(query, params);
    res.json({ assets: rows });
  } catch (err) {
    console.error('GET /api/assets error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/assets
app.post('/api/assets', async (req, res) => {
  const { user_id, image_url, platform, name, server_id, server_name, is_animated, is_favorite } = req.body;

  if (!user_id || !image_url || !platform || !name) {
    return res.status(400).json({ error: 'user_id, image_url, platform, name required.' });
  }

  try {
    // Vérification de doublon par (user_id, image_url).
    const exists = await db.query(
      'SELECT id, server_id, server_name FROM assets WHERE user_id = $1 AND image_url = $2',
      [user_id, image_url]
    );
    if (exists.rows.length > 0) {
      const existing = exists.rows[0];
      // Si l'emoji existe mais sans association serveur, on l'enrichit silencieusement
      // plutôt que de rejeter : l'auto-save peut découvrir le serveur plus tard.
      if ((server_id || server_name) && !existing.server_id && !existing.server_name) {
        const { rows: updated } = await db.query(
          'UPDATE assets SET server_id = $1, server_name = $2, updated_at = now() WHERE id = $3 RETURNING *',
          [server_id || null, server_name || null, existing.id]
        );
        return res.json({ asset: updated[0] });
      }
      return res.status(409).json({ error: 'Already saved.' });
    }

    const { rows } = await db.query(
      'INSERT INTO assets (user_id, image_url, platform, name, server_id, server_name, is_animated, is_favorite) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user_id, image_url, platform, name, server_id || null, server_name || null, !!is_animated, !!is_favorite]
    );
    res.status(201).json({ asset: rows[0] });
  } catch (err) {
    console.error('POST /api/assets error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/assets/:id
app.patch('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  const { name, is_favorite } = req.body;
  if (name === undefined && is_favorite === undefined) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }
  const set = [];
  const params = [];
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
    if (rows.length === 0) return res.status(404).json({ error: 'Asset not found.' });
    res.json({ asset: rows[0] });
  } catch (err) {
    console.error('PATCH /api/assets/:id error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/assets/:id
app.delete('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM assets WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/assets/:id error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`EmoteVault backend running on port ${PORT}`);
});

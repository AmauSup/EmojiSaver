# EmoteVault

Extension navigateur WebExtension pour sauvegarder et gérer vos emojis Discord custom, avec backend Node.js/Express et base PostgreSQL (hébergée sur Neon).

## Structure du projet

```
/extension      # Code de l’extension navigateur
/backend        # Backend Node.js/Express
```

## Prérequis
- Node.js >= 16
- Compte Neon (https://neon.tech/) pour la base PostgreSQL

---

## 1. Installation du backend

```bash
cd backend
cp .env.example .env
# Modifiez .env avec vos infos Neon
npm install
```

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

## 2. Préparer la base de données

Voici un exemple de schéma SQL à exécuter sur Neon :

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT
);

CREATE TABLE emojis (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  discord_emoji_id TEXT,
  image_url TEXT NOT NULL,
  is_animated BOOLEAN DEFAULT FALSE,
  name TEXT DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE emoji_tags (
  emoji_id INTEGER REFERENCES emojis(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (emoji_id, tag_id)
);

INSERT INTO users (id, username) VALUES ('demo-user-123', 'Démo');
```

---

## 3. Installation de l’extension navigateur

1. Ouvrez Chrome/Edge/Brave → Extensions → Mode développeur → Charger l’extension non empaquetée → Sélectionnez le dossier `/extension`.
2. Vérifiez que le backend tourne sur http://localhost:3000.
3. Rendez-vous sur Discord Web, faites clic droit sur un emoji custom → “Save emoji to EmoteVault”.
4. Ouvrez la popup de l’extension pour voir vos emojis sauvegardés.

---

## 4. Variables d’environnement

Voir `/backend/.env.example`.

---

## 5. Dépendances principales

- Backend : express, pg, dotenv, cors
- Extension : JavaScript vanilla, Manifest V3

---

## 6. Fonctionnalités

### Extension
- Menu clic droit “Save emoji to EmoteVault” sur les images emojis Discord
- Popup : liste, recherche, copier URL, suppression

### Backend
- API REST CRUD emojis
- Validation, gestion d’erreurs, CORS, pas de doublons

---

## 7. Pour aller plus loin
- Ajouter authentification
- Ajout/édition de tags
- Synchronisation multi-appareils

---

## Support
Projet étudiant, contributions bienvenues !

// EmoteVault - popup.js
// Affiche les assets sauvegardés, recherche, filtres, favoris, copie, suppression


const BACKEND_URL = "http://localhost:3000";
const loginSection = document.getElementById("login-section");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const loginError = document.getElementById("login-error");
const mainSection = document.getElementById("main-section");
const assetListDiv = document.getElementById("asset-list");
const searchInput = document.getElementById("search");
const favFilter = document.getElementById("fav-filter");
const logoutBtn = document.getElementById("logout-btn");
const discordIdInput = document.getElementById("discord-id-input");
const discordLinkInput = document.getElementById("discord-link-input");
const discordNameInput = document.getElementById("discord-name-input");
const discordLinkBtn = document.getElementById("discord-link-btn");
const discordFormatResult = document.getElementById("discord-format-result");
const discordCopyBtn = document.getElementById("discord-copy-btn");
const discordSaveBtn = document.getElementById("discord-save-btn");
const discordPreviewImage = document.getElementById("discord-preview-image");
const autoSaveServerBtn = document.getElementById("auto-save-server-btn");
const autoSaveStatus = document.getElementById("auto-save-status");

function normalizeDiscordEmojiName(rawName) {
  return (rawName || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/\W/g, "")
    .slice(0, 120);
}

function buildDiscordEmojiUrl(emojiId, emojiName, extension) {
  const encodedName = encodeURIComponent(emojiName);
  return `https://cdn.discordapp.com/emojis/${emojiId}.${extension}?size=48&name=${encodedName}&lossless=true`;
}

function probeImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(url);
    image.onerror = () => reject(new Error("load_failed"));
    image.src = url;
  });
}

async function resolveDiscordEmojiAsset(emojiId, emojiName) {
  const gifUrl = buildDiscordEmojiUrl(emojiId, emojiName, "gif");
  const webpUrl = buildDiscordEmojiUrl(emojiId, emojiName, "webp");

  try {
    await probeImage(gifUrl);
    return { imageUrl: gifUrl, isAnimated: true };
  } catch {
    await probeImage(webpUrl);
    return { imageUrl: webpUrl, isAnimated: false };
  }
}

function resetDiscordBuilder(message = "") {
  discordLinkInput.value = "";
  discordPreviewImage.removeAttribute("src");
  discordPreviewImage.style.display = "none";
  discordFormatResult.textContent = message;
  discordCopyBtn.style.display = "none";
  discordSaveBtn.style.display = "none";
  discordCopyBtn.onclick = null;
  discordSaveBtn.onclick = null;
}

async function saveDiscordAsset(asset) {
  if (!USER_ID) {
    alert("Connecte-toi d'abord !");
    return;
  }

  const res = await fetch(`${BACKEND_URL}/api/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...asset, user_id: USER_ID })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Erreur lors de l'enregistrement.");
  }

  fetchAssets();
}

function buildDiscordFormat(emoji) {
  if (!emoji?.id || !emoji?.name) return null;
  return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
}

function mapScannedEmojiToAssetPayload(emoji) {
  const safeName = (emoji.name || `emoji_${emoji.id}`).trim();
  return {
    image_url: emoji.url,
    page_url: emoji.pageUrl || "https://discord.com",
    platform: "discord",
    asset_type: emoji.animated ? "emoji_animated" : "emoji",
    name: safeName,
    is_animated: !!emoji.animated,
    source_id: emoji.id,
    source_metadata: {
      emoji_id: emoji.id,
      emoji_name: safeName,
      discord_format: buildDiscordFormat({ ...emoji, name: safeName }),
      source: "server-auto-scan"
    }
  };
}

function extractVisibleDiscordEmojisFromActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0];
      const tabUrl = activeTab?.url || "";

      if (!activeTab?.id) {
        reject(new Error("Aucun onglet actif détecté."));
        return;
      }

      if (!/https:\/\/(?:www\.)?discord\.com\//.test(tabUrl) && !/https:\/\/(?:www\.)?discordapp\.com\//.test(tabUrl)) {
        reject(new Error("Ouvre Discord dans l'onglet actif avant de lancer l'extraction."));
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "emotevault_extract_server_emojis" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Impossible de contacter la page Discord."));
          return;
        }

        if (!response?.success) {
          reject(new Error(response?.error || "Extraction impossible."));
          return;
        }

        resolve(response.emojis || []);
      });
    });
  });
}

async function saveExtractedEmojis(emojis) {
  let saved = 0;
  let duplicates = 0;
  let failed = 0;

  for (const emoji of emojis) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mapScannedEmojiToAssetPayload(emoji),
          user_id: USER_ID
        })
      });

      if (response.ok) {
        saved += 1;
      } else if (response.status === 409) {
        duplicates += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { saved, duplicates, failed };
}

discordLinkBtn.addEventListener("click", async () => {
  const emojiId = discordIdInput.value.trim();
  const emojiName = normalizeDiscordEmojiName(discordNameInput.value) || "emoji";

  if (!/^\d{5,}$/.test(emojiId)) {
    resetDiscordBuilder("ID invalide.");
    return;
  }

  discordNameInput.value = emojiName;
  discordFormatResult.textContent = "Chargement de la prévisualisation...";

  try {
    const { imageUrl, isAnimated } = await resolveDiscordEmojiAsset(emojiId, emojiName);

    discordLinkInput.value = imageUrl;
    discordPreviewImage.src = imageUrl;
    discordPreviewImage.style.display = "block";
    discordFormatResult.textContent = isAnimated ? "Emoji animé détecté." : "Emoji statique détecté.";
    discordCopyBtn.style.display = "inline-block";
    discordSaveBtn.style.display = "inline-block";

    discordCopyBtn.onclick = () => {
      navigator.clipboard.writeText(imageUrl);
    };

    discordSaveBtn.onclick = async () => {
      try {
        await saveDiscordAsset({
          image_url: imageUrl,
          page_url: "https://discord.com",
          platform: "discord",
          asset_type: isAnimated ? "emoji_animated" : "emoji",
          name: emojiName,
          is_animated: isAnimated,
          source_id: emojiId,
          source_metadata: {
            emoji_id: emojiId,
            emoji_name: emojiName,
            generated_from: "popup-id-builder"
          }
        });
        alert("Emoji enregistré dans EmoteVault !");
      } catch (error) {
        alert(error.message || "Erreur lors de l'enregistrement.");
      }
    };
  } catch {
    resetDiscordBuilder("Impossible de prévisualiser cet emoji avec cet ID.");
  }
});

let USER_ID = null;

function showMain() {
  loginSection.style.display = "none";
  mainSection.style.display = "block";
}
function showLogin() {
  loginSection.style.display = "block";
  mainSection.style.display = "none";
}

function setUserId(id) {
  USER_ID = id;
  chrome.storage.local.set({ emotevault_user_id: id });
}

function tryAutoLogin() {
  chrome.storage.local.get(["emotevault_user_id"], (result) => {
    if (result.emotevault_user_id) {
      USER_ID = result.emotevault_user_id;
      showMain();
      fetchAssets();
    } else {
      showLogin();
    }
  });
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) {
    loginError.textContent = "Pseudo requis.";
    return;
  }
  loginError.textContent = "";
  try {
    const res = await fetch(`${BACKEND_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.user?.id) {
      setUserId(data.user.id);
      showMain();
      fetchAssets();
    } else {
      loginError.textContent = "Erreur lors de la création/connexion utilisateur.";
    }
  } catch {
    loginError.textContent = "Erreur réseau.";
  }
});

logoutBtn.addEventListener("click", () => {
  chrome.storage.local.remove(["emotevault_user_id"], () => {
    USER_ID = null;
    showLogin();
  });
});

autoSaveServerBtn.addEventListener("click", async () => {
  if (!USER_ID) {
    autoSaveStatus.textContent = "Connecte-toi d'abord.";
    return;
  }

  autoSaveServerBtn.disabled = true;
  autoSaveStatus.textContent = "Scan Discord en cours...";

  try {
    const emojis = await extractVisibleDiscordEmojisFromActiveTab();

    if (emojis.length === 0) {
      autoSaveStatus.textContent = "Aucun emoji custom trouvé sur le contenu visible.";
      autoSaveServerBtn.disabled = false;
      return;
    }

    autoSaveStatus.textContent = `${emojis.length} emoji(s) trouvé(s), sauvegarde en cours...`;
    const result = await saveExtractedEmojis(emojis);
    autoSaveStatus.textContent = `Terminé: ${result.saved} ajouté(s), ${result.duplicates} déjà présent(s), ${result.failed} erreur(s).`;
    fetchAssets();
  } catch (error) {
    autoSaveStatus.textContent = error?.message || "Erreur pendant la sauvegarde automatique.";
  } finally {
    autoSaveServerBtn.disabled = false;
  }
});

function renderAssets(assets) {
  assetListDiv.innerHTML = "";
  if (assets.length === 0) {
    assetListDiv.innerHTML = "<p>Aucun asset sauvegardé.</p>";
    return;
  }
  assets.forEach(asset => {
    const fullName = asset.name || "emoji";
    const displayName = fullName.length > 16 ? `${fullName.slice(0, 15)}…` : fullName;
    const div = document.createElement("div");
    div.className = "emoji-item";
    div.innerHTML = `
      <img src="${asset.image_url}" alt="${fullName}" width="32" height="32">
      <div class="emoji-name" title="${fullName}">${displayName}</div>
      <button class="copy-btn" data-url="${asset.image_url}">Copier URL</button>
      <button class="edit-btn" data-id="${asset.id}" data-name="${asset.name}">Éditer</button>
      <button class="fav-btn" data-id="${asset.id}" style="color:${asset.is_favorite ? '#ffd700':'#aaa'}">⭐</button>
      <button class="delete-btn" data-id="${asset.id}">🗑️</button>
    `;
    assetListDiv.appendChild(div);
  });
}

function fetchAssets() {
  if (!USER_ID) return;
  let url = `${BACKEND_URL}/api/assets?user_id=${USER_ID}`;
  const fav = favFilter.checked;
  if (fav) url += `&is_favorite=true`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      globalThis._allAssets = data.assets || [];
      renderAssets(globalThis._allAssets);
    })
    .catch(() => {
      assetListDiv.innerHTML = "<p>Erreur de chargement.</p>";
    });
}

function filterAssets() {
  const q = searchInput.value.toLowerCase();
  let filtered = globalThis._allAssets || [];
  if (q) filtered = filtered.filter(e => e.name.toLowerCase().includes(q));
  renderAssets(filtered);
}

searchInput.addEventListener("input", filterAssets);
favFilter.addEventListener("change", fetchAssets);

assetListDiv.addEventListener("click", e => {
  if (e.target.classList.contains("copy-btn")) {
    navigator.clipboard.writeText(e.target.dataset.url);
  }
  if (e.target.classList.contains("edit-btn")) {
    const id = e.target.dataset.id;
    const currentName = e.target.dataset.name || "";
    const nextName = prompt("Nouveau nom de l'emoji :", currentName);
    if (!nextName?.trim()) return;

    fetch(`${BACKEND_URL}/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName.trim() })
    }).then(() => fetchAssets());
  }
  if (e.target.classList.contains("delete-btn")) {
    const id = e.target.dataset.id;
    fetch(`${BACKEND_URL}/api/assets/${id}`, { method: "DELETE" })
      .then(() => fetchAssets());
  }
  if (e.target.classList.contains("fav-btn")) {
    const id = e.target.dataset.id;
    fetch(`${BACKEND_URL}/api/assets/${id}`, {
      method: "PATCH",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: true })
    }).then(() => fetchAssets());
  }
});

tryAutoLogin();

// EmoteVault - popup.js
// Structure: state -> DOM -> utils -> API -> features -> render -> handlers -> init

const BACKEND_URL = "http://localhost:3000";
const MAX_NAME_LENGTH = 16;

const state = {
  userId: null,
  assets: []
};

const dom = {
  loginSection: document.getElementById("login-section"),
  loginForm: document.getElementById("login-form"),
  usernameInput: document.getElementById("username-input"),
  loginError: document.getElementById("login-error"),
  mainSection: document.getElementById("main-section"),
  assetList: document.getElementById("asset-list"),
  searchInput: document.getElementById("search"),
  sortFilter: document.getElementById("sort-filter"),
  favFilter: document.getElementById("fav-filter"),
  logoutBtn: document.getElementById("logout-btn"),
  discordIdInput: document.getElementById("discord-id-input"),
  discordLinkInput: document.getElementById("discord-link-input"),
  discordNameInput: document.getElementById("discord-name-input"),
  discordLinkBtn: document.getElementById("discord-link-btn"),
  discordFormatResult: document.getElementById("discord-format-result"),
  discordCopyBtn: document.getElementById("discord-copy-btn"),
  discordSaveBtn: document.getElementById("discord-save-btn"),
  discordPreviewImage: document.getElementById("discord-preview-image"),
  autoSaveServerBtn: document.getElementById("auto-save-server-btn"),
  autoSaveStatus: document.getElementById("auto-save-status")
};

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function truncateName(value) {
  if ((value || "").length <= MAX_NAME_LENGTH) return value;
  return `${value.slice(0, MAX_NAME_LENGTH - 1)}…`;
}

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

function buildDiscordFormat(emoji) {
  if (!emoji?.id || !emoji?.name) return null;
  return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || "Erreur serveur.");
  }

  return body;
}

async function createOrLoginUser(username) {
  const body = await apiRequest("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });

  return body.user;
}

async function fetchAssetsForUser() {
  const params = new URLSearchParams({ user_id: state.userId });
  if (dom.favFilter.checked) {
    params.set("is_favorite", "true");
  }

  const body = await apiRequest(`/api/assets?${params.toString()}`);
  return body.assets || [];
}

async function createAsset(assetPayload) {
  return apiRequest("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...assetPayload, user_id: state.userId })
  });
}

async function updateAsset(assetId, payload) {
  return apiRequest(`/api/assets/${assetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function deleteAsset(assetId) {
  return apiRequest(`/api/assets/${assetId}`, { method: "DELETE" });
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

function showMainView() {
  setHidden(dom.loginSection, true);
  setHidden(dom.mainSection, false);
}

function showLoginView() {
  setHidden(dom.loginSection, false);
  setHidden(dom.mainSection, true);
}

function setUserId(userId) {
  state.userId = userId;
  chrome.storage.local.set({ emotevault_user_id: userId });
}

function clearDiscordBuilder(message = "") {
  dom.discordLinkInput.value = "";
  dom.discordPreviewImage.removeAttribute("src");
  setHidden(dom.discordPreviewImage, true);
  dom.discordFormatResult.textContent = message;
  setHidden(dom.discordCopyBtn, true);
  setHidden(dom.discordSaveBtn, true);
  dom.discordCopyBtn.onclick = null;
  dom.discordSaveBtn.onclick = null;
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

function extractVisibleDiscordEmojisFromActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0];
      const tabUrl = activeTab?.url || "";

      if (!activeTab?.id) {
        reject(new Error("Aucun onglet actif détecté."));
        return;
      }

      const isDiscordTab = /https:\/\/(?:www\.)?discord\.com\//.test(tabUrl)
        || /https:\/\/(?:www\.)?discordapp\.com\//.test(tabUrl);

      if (!isDiscordTab) {
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
      await createAsset(mapScannedEmojiToAssetPayload(emoji));
      saved += 1;
    } catch (error) {
      if (String(error.message || "").includes("Déjà enregistré")) {
        duplicates += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { saved, duplicates, failed };
}

function renderAssets(assets) {
  dom.assetList.innerHTML = "";

  if (assets.length === 0) {
    dom.assetList.innerHTML = "<p>Aucun asset sauvegardé.</p>";
    return;
  }

  assets.forEach((asset) => {
    const fullName = asset.name || "emoji";
    const displayName = truncateName(fullName);
    const favoriteColor = asset.is_favorite ? "#7289da" : "#99aab5";
    const item = document.createElement("div");

    item.className = "emoji-item";
    item.innerHTML = `
      <img src="${asset.image_url}" alt="${fullName}" width="32" height="32">
      <div class="emoji-name" title="${fullName}">${displayName}</div>
      <button class="copy-btn" data-url="${asset.image_url}">URL</button>
      <button class="edit-btn" data-id="${asset.id}" data-name="${fullName}">Edit</button>
      <button class="fav-btn" data-id="${asset.id}" data-favorite="${asset.is_favorite ? "true" : "false"}" style="color:${favoriteColor}">★</button>
      <button class="delete-btn" data-id="${asset.id}">✕</button>
    `;

    dom.assetList.appendChild(item);
  });
}

function filterAndRenderAssets() {
  const query = dom.searchInput.value.toLowerCase();
  let filtered = [...state.assets];

  if (query) {
    filtered = filtered.filter((asset) => (asset.name || "").toLowerCase().includes(query));
  }

  if (dom.sortFilter.value === "name-asc") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (dom.sortFilter.value === "name-desc") {
    filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
  }

  renderAssets(filtered);
}

async function refreshAssets() {
  if (!state.userId) return;

  try {
    state.assets = await fetchAssetsForUser();
    filterAndRenderAssets();
  } catch {
    dom.assetList.innerHTML = "<p>Erreur de chargement.</p>";
  }
}

async function handleDiscordBuilderClick() {
  const emojiId = dom.discordIdInput.value.trim();
  const emojiName = normalizeDiscordEmojiName(dom.discordNameInput.value) || "emoji";

  if (!/^\d{5,}$/.test(emojiId)) {
    clearDiscordBuilder("ID invalide.");
    return;
  }

  dom.discordNameInput.value = emojiName;
  dom.discordFormatResult.textContent = "Chargement de la prévisualisation...";

  try {
    const { imageUrl, isAnimated } = await resolveDiscordEmojiAsset(emojiId, emojiName);
    dom.discordLinkInput.value = imageUrl;
    dom.discordPreviewImage.src = imageUrl;
    setHidden(dom.discordPreviewImage, false);
    dom.discordFormatResult.textContent = isAnimated ? "Emoji animé détecté." : "Emoji statique détecté.";
    setHidden(dom.discordCopyBtn, false);
    setHidden(dom.discordSaveBtn, false);

    dom.discordCopyBtn.onclick = () => navigator.clipboard.writeText(imageUrl);
    dom.discordSaveBtn.onclick = async () => {
      try {
        await createAsset({
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
        refreshAssets();
        alert("Emoji enregistré dans EmoteVault !");
      } catch (error) {
        alert(error.message || "Erreur lors de l'enregistrement.");
      }
    };
  } catch {
    clearDiscordBuilder("Impossible de prévisualiser cet emoji avec cet ID.");
  }
}

async function handleAutoSaveClick() {
  if (!state.userId) {
    dom.autoSaveStatus.textContent = "Connecte-toi d'abord.";
    return;
  }

  dom.autoSaveServerBtn.disabled = true;
  dom.autoSaveStatus.textContent = "Scan Discord en cours...";

  try {
    const emojis = await extractVisibleDiscordEmojisFromActiveTab();
    if (emojis.length === 0) {
      dom.autoSaveStatus.textContent = "Aucun emoji custom trouvé sur le contenu visible.";
      return;
    }

    dom.autoSaveStatus.textContent = `${emojis.length} emoji(s) trouvé(s), sauvegarde en cours...`;
    const result = await saveExtractedEmojis(emojis);
    dom.autoSaveStatus.textContent = `Terminé: ${result.saved} ajouté(s), ${result.duplicates} déjà présent(s), ${result.failed} erreur(s).`;
    refreshAssets();
  } catch (error) {
    dom.autoSaveStatus.textContent = error?.message || "Erreur pendant la sauvegarde automatique.";
  } finally {
    dom.autoSaveServerBtn.disabled = false;
  }
}

async function handleAssetListClick(event) {
  const target = event.target;

  if (target.classList.contains("copy-btn")) {
    navigator.clipboard.writeText(target.dataset.url || "");
    return;
  }

  if (target.classList.contains("edit-btn")) {
    const assetId = target.dataset.id;
    const currentName = target.dataset.name || "";
    const nextName = prompt("Nouveau nom de l'emoji :", currentName);
    if (!nextName?.trim()) return;

    await updateAsset(assetId, { name: nextName.trim() });
    refreshAssets();
    return;
  }

  if (target.classList.contains("delete-btn")) {
    const assetId = target.dataset.id;
    await deleteAsset(assetId);
    refreshAssets();
    return;
  }

  if (target.classList.contains("fav-btn")) {
    const assetId = target.dataset.id;
    const isFavorite = target.dataset.favorite === "true";
    await updateAsset(assetId, { is_favorite: !isFavorite });
    refreshAssets();
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = dom.usernameInput.value.trim();

  if (!username) {
    dom.loginError.textContent = "Pseudo requis.";
    return;
  }

  dom.loginError.textContent = "";
  try {
    const user = await createOrLoginUser(username);
    if (!user?.id) {
      dom.loginError.textContent = "Erreur lors de la connexion.";
      return;
    }

    setUserId(user.id);
    showMainView();
    refreshAssets();
  } catch {
    dom.loginError.textContent = "Erreur réseau.";
  }
}

function handleLogout() {
  chrome.storage.local.remove(["emotevault_user_id"], () => {
    state.userId = null;
    state.assets = [];
    showLoginView();
  });
}

function bindEvents() {
  dom.loginForm.addEventListener("submit", handleLoginSubmit);
  dom.logoutBtn.addEventListener("click", handleLogout);
  dom.searchInput.addEventListener("input", filterAndRenderAssets);
  dom.sortFilter.addEventListener("change", filterAndRenderAssets);
  dom.favFilter.addEventListener("change", refreshAssets);
  dom.discordLinkBtn.addEventListener("click", handleDiscordBuilderClick);
  dom.autoSaveServerBtn.addEventListener("click", handleAutoSaveClick);
  dom.assetList.addEventListener("click", (event) => {
    handleAssetListClick(event).catch(() => {
      dom.autoSaveStatus.textContent = "Action impossible pour le moment.";
    });
  });
}

function tryAutoLogin() {
  chrome.storage.local.get(["emotevault_user_id"], (result) => {
    if (result.emotevault_user_id) {
      state.userId = result.emotevault_user_id;
      showMainView();
      refreshAssets();
      return;
    }

    showLoginView();
  });
}

bindEvents();
tryAutoLogin();

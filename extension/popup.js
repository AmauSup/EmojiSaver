// popup.js — Interface utilisateur de l'extension EmoteVault.
// Structure : state → DOM → utils → API → features → render → handlers → init
//
// L'état (assets, filtres, sélection) est maintenu en mémoire dans `state`.
// Le filtrage et le tri sont entièrement côté client (assets déjà chargés).
// Le rafraîchissement automatique (startLiveRefresh) tourne toutes les 3,5 s.
// TODO: externaliser BACKEND_URL (actuellement codé en dur)
// TODO: remplacer l'auth par JWT (actuellement user_id stocké dans chrome.storage.local)

const BACKEND_URL = "http://localhost:3000";
const MAX_NAME_LENGTH = 16;
const AUTO_SYNC_STORAGE_KEY = "emotevault_auto_sync_enabled";
const LIVE_REFRESH_INTERVAL_MS = 3500;
const ITEMS_PER_PAGE = 20;

const state = {
  userId: null,
  username: null,
  assets: [],
  filteredAssets: [],
  selectedIds: new Set(),
  liveRefreshTimer: null,
  currentPage: 1
};

const dom = {
  loginSection: document.getElementById("login-section"),
  loginForm: document.getElementById("login-form"),
  usernameInput: document.getElementById("username-input"),
  passwordInput: document.getElementById("password-input"),
  loginError: document.getElementById("login-error"),
  mainSection: document.getElementById("main-section"),
  assetList: document.getElementById("asset-list"),
  searchInput: document.getElementById("search"),
  serverFilter: document.getElementById("server-filter"),
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
  autoSaveStatus: document.getElementById("auto-save-status"),
  accountDetails: document.getElementById("account-details"),
  currentPwdInput: document.getElementById("current-pwd-input"),
  newUsernameInput: document.getElementById("new-username-input"),
  changeUsernameBtn: document.getElementById("change-username-btn"),
  newPwdInput: document.getElementById("new-pwd-input"),
  changePwdBtn: document.getElementById("change-pwd-btn"),
  accountStatus: document.getElementById("account-status"),
  bulkBar: document.getElementById("bulk-bar"),
  bulkCount: document.getElementById("bulk-count"),
  bulkDeleteBtn: document.getElementById("bulk-delete-btn"),
  selectAllCb: document.getElementById("select-all-cb"),
  pagination: document.getElementById("pagination"),
  pagePrev: document.getElementById("page-prev"),
  pageNext: document.getElementById("page-next"),
  pageInfo: document.getElementById("page-info")
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

// Wrapper centralisé pour tous les appels au backend.
// Lève une Error avec le message d'erreur de l'API si le statut HTTP n'est pas ok.
async function apiRequest(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || "Server error.");
  }

  return body;
}

async function createOrLoginUser(username, password) {
  const body = await apiRequest("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
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
    platform: "discord",
    name: safeName,
    server_id: emoji.server_id || null,
    server_name: emoji.server_name || null,
    is_animated: !!emoji.animated
  };
}

function normalizeServerLabel(asset) {
  return asset.server_name || asset.server_id || "No server";
}

function normalizeServerKey(asset) {
  return asset.server_id || "__unknown__";
}

function rebuildServerFilterOptions(assets) {
  const selected = dom.serverFilter.value || "";
  const byServer = new Map();

  assets.forEach((asset) => {
    const key = normalizeServerKey(asset);
    if (!byServer.has(key)) {
      byServer.set(key, normalizeServerLabel(asset));
    }
  });

  const entries = Array.from(byServer.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  dom.serverFilter.innerHTML = '<option value="">All servers</option>';
  entries.forEach(([key, label]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    dom.serverFilter.appendChild(option);
  });

  if (Array.from(dom.serverFilter.options).some((opt) => opt.value === selected)) {
    dom.serverFilter.value = selected;
  }
}

function updateBulkBar() {
  const count = state.selectedIds.size;
  setHidden(dom.bulkBar, count === 0);
  dom.bulkCount.textContent = `${count} selected`;

  const pageCbs = Array.from(dom.assetList.querySelectorAll(".select-cb"));
  const allChecked = pageCbs.length > 0 && pageCbs.every((cb) => state.selectedIds.has(cb.dataset.id));
  const someChecked = pageCbs.some((cb) => state.selectedIds.has(cb.dataset.id));
  dom.selectAllCb.checked = allChecked;
  dom.selectAllCb.indeterminate = someChecked && !allChecked;
}

function showMainView() {
  setHidden(dom.loginSection, true);
  setHidden(dom.mainSection, false);
  startLiveRefresh();
}

function showLoginView() {
  setHidden(dom.loginSection, false);
  setHidden(dom.mainSection, true);
  stopLiveRefresh();
}

// Rafraîchissement périodique pour refléter les emojis sauvegardés par l'auto-sync
// ou le clic droit pendant que le popup est ouvert.
function startLiveRefresh() {
  stopLiveRefresh();
  state.liveRefreshTimer = globalThis.setInterval(() => {
    if (state.userId) {
      refreshAssets();
    }
  }, LIVE_REFRESH_INTERVAL_MS);
}

function stopLiveRefresh() {
  if (!state.liveRefreshTimer) return;
  globalThis.clearInterval(state.liveRefreshTimer);
  state.liveRefreshTimer = null;
}

function setUserData(user) {
  state.userId = user.id;
  state.username = user.username;
  chrome.storage.local.set({ emotevault_user_id: user.id, emotevault_username: user.username });
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

// Détecte si un emoji est animé en sondant d'abord l'URL GIF.
// Si le chargement GIF réussit → animé ; sinon → statique (webp).
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

// Envoie un message au content script de l'onglet actif pour extraire les emojis visibles.
// Vérifie d'abord que l'onglet est sur Discord (content.js n'est injecté que sur discord.com).
function extractVisibleDiscordEmojisFromActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0];
      const tabUrl = activeTab?.url || "";

      if (!activeTab?.id) {
        reject(new Error("No active tab detected."));
        return;
      }

      const isDiscordTab = /https:\/\/(?:www\.)?discord\.com\//.test(tabUrl)
        || /https:\/\/(?:www\.)?discordapp\.com\//.test(tabUrl);

      if (!isDiscordTab) {
        reject(new Error("Open Discord in the active tab first."));
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "emotevault_extract_server_emojis" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Could not contact Discord page."));
          return;
        }

        if (!response?.success) {
          reject(new Error(response?.error || "Extraction failed."));
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

// Rendu paginé côté client (ITEMS_PER_PAGE = 20).
// Tous les assets sont en mémoire ; la pagination ne déclenche pas de requête API.
function renderAssets(assets) {
  dom.assetList.innerHTML = "";

  const totalPages = Math.max(1, Math.ceil(assets.length / ITEMS_PER_PAGE));
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  if (assets.length === 0) {
    dom.assetList.innerHTML = "<p>No saved emojis.</p>";
    setHidden(dom.pagination, true);
    updateBulkBar();
    return;
  }

  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  const pageAssets = assets.slice(start, start + ITEMS_PER_PAGE);

  pageAssets.forEach((asset) => {
    const fullName = asset.name || "emoji";
    const displayName = truncateName(fullName);
    const favoriteColor = asset.is_favorite ? "#ffd700" : "#99aab5";
    const serverLabel = asset.server_name || "";
    const isSelected = state.selectedIds.has(asset.id);
    const item = document.createElement("div");

    item.className = "emoji-item";
    item.innerHTML = `
      <input type="checkbox" class="select-cb" data-id="${asset.id}"${isSelected ? " checked" : ""}>
      <img src="${asset.image_url}" alt="${fullName}" width="32" height="32">
      <div class="emoji-meta">
        <div class="emoji-name" title="${fullName}">${displayName}</div>
        ${serverLabel ? `<div class="emoji-server">${serverLabel}</div>` : ""}
      </div>
      <button class="copy-btn" data-url="${asset.image_url}">Copy</button>
      <button class="edit-btn" data-id="${asset.id}" data-name="${fullName}">Edit</button>
      <button class="fav-btn" data-id="${asset.id}" data-favorite="${asset.is_favorite ? "true" : "false"}" style="color:${favoriteColor}">★</button>
      <button class="delete-btn" data-id="${asset.id}">✕</button>
    `;

    dom.assetList.appendChild(item);
  });

  const showPagination = totalPages > 1;
  setHidden(dom.pagination, !showPagination);
  if (showPagination) {
    dom.pageInfo.textContent = `${state.currentPage} / ${totalPages}`;
    dom.pagePrev.disabled = state.currentPage <= 1;
    dom.pageNext.disabled = state.currentPage >= totalPages;
  }

  updateBulkBar();
}

// Filtrage et tri entièrement côté client sur state.assets (déjà en mémoire).
// Exception : le filtre favori déclenche un rechargement API car il est géré par le backend.
function filterAndRenderAssets() {
  const query = dom.searchInput.value.toLowerCase();
  let filtered = [...state.assets];
  const selectedServer = dom.serverFilter.value;

  if (selectedServer) {
    filtered = filtered.filter((asset) => normalizeServerKey(asset) === selectedServer);
  }

  if (query) {
    filtered = filtered.filter((asset) => (asset.name || "").toLowerCase().includes(query));
  }

  if (dom.sortFilter.value === "name-asc") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (dom.sortFilter.value === "name-desc") {
    filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
  } else if (dom.sortFilter.value === "server-asc") {
    filtered.sort((a, b) => normalizeServerLabel(a).localeCompare(normalizeServerLabel(b)));
  } else if (dom.sortFilter.value === "server-desc") {
    filtered.sort((a, b) => normalizeServerLabel(b).localeCompare(normalizeServerLabel(a)));
  }

  state.filteredAssets = filtered;
  renderAssets(filtered);
}

async function refreshAssets() {
  if (!state.userId) return;

  try {
    state.assets = await fetchAssetsForUser();
    rebuildServerFilterOptions(state.assets);
    filterAndRenderAssets();
  } catch {
    dom.assetList.innerHTML = "<p>Loading error.</p>";
  }
}

async function handleDiscordBuilderClick() {
  const emojiId = dom.discordIdInput.value.trim();
  const emojiName = normalizeDiscordEmojiName(dom.discordNameInput.value) || "emoji";

  if (!/^\d{5,}$/.test(emojiId)) {
    clearDiscordBuilder("Invalid ID.");
    return;
  }

  dom.discordNameInput.value = emojiName;
  dom.discordFormatResult.textContent = "Loading preview...";

  try {
    const { imageUrl, isAnimated } = await resolveDiscordEmojiAsset(emojiId, emojiName);
    dom.discordLinkInput.value = imageUrl;
    dom.discordPreviewImage.src = imageUrl;
    setHidden(dom.discordPreviewImage, false);
    dom.discordFormatResult.textContent = isAnimated ? "Animated emoji." : "Static emoji.";
    setHidden(dom.discordCopyBtn, false);
    setHidden(dom.discordSaveBtn, false);

    dom.discordCopyBtn.onclick = () => navigator.clipboard.writeText(imageUrl);
    dom.discordSaveBtn.onclick = async () => {
      dom.discordSaveBtn.disabled = true;
      try {
        await createAsset({
          image_url: imageUrl,
          platform: "discord",
          name: emojiName,
          server_id: null,
          server_name: null,
          is_animated: isAnimated
        });
        dom.discordFormatResult.textContent = "Saved!";
        refreshAssets();
      } catch (error) {
        dom.discordFormatResult.textContent = error.message || "Save failed.";
      } finally {
        dom.discordSaveBtn.disabled = false;
      }
    };
  } catch {
    clearDiscordBuilder("Could not preview emoji with this ID.");
  }
}

// L'auto-save nécessite deux actions synchronisées :
// 1. Mettre à jour chrome.storage.local (lu par content.js au prochain démarrage)
// 2. Envoyer un message au content script pour activer/désactiver immédiatement
async function handleAutoSaveClick() {
  if (!state.userId) {
    dom.autoSaveStatus.textContent = "Log in first.";
    return;
  }

  const currentEnabled = await new Promise((resolve) => {
    chrome.storage.local.get([AUTO_SYNC_STORAGE_KEY], (result) => {
      resolve(!!result[AUTO_SYNC_STORAGE_KEY]);
    });
  });

  const nextEnabled = !currentEnabled;
  chrome.storage.local.set({ [AUTO_SYNC_STORAGE_KEY]: nextEnabled });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs?.[0];
    if (!activeTab?.id) return;

    chrome.tabs.sendMessage(activeTab.id, {
      type: "emotevault:auto-sync:set",
      enabled: nextEnabled
    }, () => {
      if (chrome.runtime.lastError) {
        return;
      }
    });
  });

  dom.autoSaveServerBtn.textContent = nextEnabled ? "Disable auto-save" : "Enable auto-save";
  dom.autoSaveStatus.textContent = nextEnabled ? "Auto-save enabled." : "Auto-save disabled.";
}

function loadAutoSaveState() {
  chrome.storage.local.get([AUTO_SYNC_STORAGE_KEY], (result) => {
    const enabled = !!result[AUTO_SYNC_STORAGE_KEY];
    dom.autoSaveServerBtn.textContent = enabled ? "Disable auto-save" : "Enable auto-save";
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[AUTO_SYNC_STORAGE_KEY]) return;

  const enabled = !!changes[AUTO_SYNC_STORAGE_KEY].newValue;
  dom.autoSaveServerBtn.textContent = enabled ? "Disable auto-save" : "Enable auto-save";
});

async function handleChangeUsername() {
  const newUsername = dom.newUsernameInput.value.trim();
  const currentPwd = dom.currentPwdInput.value;

  if (!currentPwd) { dom.accountStatus.textContent = "Current password required."; return; }
  if (!newUsername) { dom.accountStatus.textContent = "New username required."; return; }

  dom.accountStatus.textContent = "";
  try {
    const body = await apiRequest(`/api/users/${state.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPwd, new_username: newUsername })
    });
    state.username = body.user.username;
    chrome.storage.local.set({ emotevault_username: state.username });
    dom.accountStatus.textContent = "Username updated.";
    dom.newUsernameInput.value = "";
  } catch (err) {
    dom.accountStatus.textContent = err.message || "Update failed.";
  }
}

async function handleChangePassword() {
  const currentPwd = dom.currentPwdInput.value;
  const newPwd = dom.newPwdInput.value;

  if (!currentPwd) { dom.accountStatus.textContent = "Current password required."; return; }
  if (!newPwd) { dom.accountStatus.textContent = "New password required."; return; }

  dom.accountStatus.textContent = "";
  try {
    await apiRequest(`/api/users/${state.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
    });
    dom.accountStatus.textContent = "Password updated.";
    dom.currentPwdInput.value = "";
    dom.newPwdInput.value = "";
  } catch (err) {
    dom.accountStatus.textContent = err.message || "Update failed.";
  }
}

async function handleBulkDelete() {
  if (state.selectedIds.size === 0) return;
  dom.bulkDeleteBtn.disabled = true;
  for (const id of Array.from(state.selectedIds)) {
    await deleteAsset(id).catch(() => {});
  }
  state.selectedIds.clear();
  await refreshAssets();
  updateBulkBar();
  dom.bulkDeleteBtn.disabled = false;
}

function handleSelectAll() {
  const pageCbs = dom.assetList.querySelectorAll(".select-cb");
  if (dom.selectAllCb.checked) {
    pageCbs.forEach((cb) => { state.selectedIds.add(cb.dataset.id); cb.checked = true; });
  } else {
    pageCbs.forEach((cb) => { state.selectedIds.delete(cb.dataset.id); cb.checked = false; });
  }
  updateBulkBar();
}

async function handleAssetListClick(event) {
  const target = event.target;

  if (target.classList.contains("select-cb")) {
    if (target.checked) state.selectedIds.add(target.dataset.id);
    else state.selectedIds.delete(target.dataset.id);
    updateBulkBar();
    return;
  }

  if (target.classList.contains("copy-btn")) {
    navigator.clipboard.writeText(target.dataset.url || "");
    return;
  }

  if (target.classList.contains("edit-btn")) {
    const assetId = target.dataset.id;
    const currentName = target.dataset.name || "";
    const nextName = prompt("New emoji name:", currentName);
    if (!nextName?.trim()) return;

    await updateAsset(assetId, { name: nextName.trim() });
    refreshAssets();
    return;
  }

  if (target.classList.contains("delete-btn")) {
    const assetId = target.dataset.id;
    await deleteAsset(assetId);
    state.selectedIds.delete(assetId);
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
  const password = dom.passwordInput.value;

  if (!username) {
    dom.loginError.textContent = "Username required.";
    return;
  }

  if (!password) {
    dom.loginError.textContent = "Password required.";
    return;
  }

  dom.loginError.textContent = "";
  try {
    const user = await createOrLoginUser(username, password);
    if (!user?.id) {
      dom.loginError.textContent = "Login error.";
      return;
    }

    setUserData(user);
    showMainView();
    refreshAssets();
  } catch (err) {
    dom.loginError.textContent = err.message || "Network error.";
  }
}

function handleLogout() {
  chrome.storage.local.remove(["emotevault_user_id", "emotevault_username"], () => {
    state.userId = null;
    state.username = null;
    state.assets = [];
    state.selectedIds.clear();
    showLoginView();
  });
}

function bindEvents() {
  dom.loginForm.addEventListener("submit", handleLoginSubmit);
  dom.logoutBtn.addEventListener("click", handleLogout);
  dom.searchInput.addEventListener("input", () => { state.currentPage = 1; filterAndRenderAssets(); });
  dom.serverFilter.addEventListener("change", () => { state.currentPage = 1; filterAndRenderAssets(); });
  dom.sortFilter.addEventListener("change", () => { state.currentPage = 1; filterAndRenderAssets(); });
  dom.favFilter.addEventListener("change", refreshAssets);
  dom.pagePrev.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderAssets(state.filteredAssets);
    }
  });
  dom.pageNext.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.filteredAssets.length / ITEMS_PER_PAGE));
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderAssets(state.filteredAssets);
    }
  });
  dom.changeUsernameBtn.addEventListener("click", () => handleChangeUsername().catch(() => {}));
  dom.changePwdBtn.addEventListener("click", () => handleChangePassword().catch(() => {}));
  dom.bulkDeleteBtn.addEventListener("click", () => handleBulkDelete().catch(() => {}));
  dom.selectAllCb.addEventListener("change", handleSelectAll);
  dom.discordLinkBtn.addEventListener("click", handleDiscordBuilderClick);
  dom.autoSaveServerBtn.addEventListener("click", handleAutoSaveClick);
  dom.assetList.addEventListener("click", (event) => {
    handleAssetListClick(event).catch(() => {
      dom.autoSaveStatus.textContent = "Action failed.";
    });
  });
}

// Restaure la session depuis chrome.storage.local si l'utilisateur était connecté.
// Pas de vérification côté serveur : la session est valide tant que l'user_id existe en base.
function tryAutoLogin() {
  chrome.storage.local.get(["emotevault_user_id", "emotevault_username"], (result) => {
    if (result.emotevault_user_id) {
      state.userId = result.emotevault_user_id;
      state.username = result.emotevault_username || "";
      showMainView();
      refreshAssets();
      return;
    }

    showLoginView();
  });
}

bindEvents();
loadAutoSaveState();
tryAutoLogin();

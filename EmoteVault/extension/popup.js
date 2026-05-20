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
const platformFilter = document.getElementById("platform-filter");
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

function renderAssets(assets) {
  assetListDiv.innerHTML = "";
  if (assets.length === 0) {
    assetListDiv.innerHTML = "<p>Aucun asset sauvegardé.</p>";
    return;
  }
  assets.forEach(asset => {
    const emojiId = asset.source_id || asset.source_metadata?.emoji_id || "";
    const emojiName = asset.source_metadata?.emoji_name || asset.name || "emoji";
    const canCopyRebuiltLink = asset.platform === "discord" && emojiId;
    const discordExtension = asset.is_animated ? "gif" : "webp";
    const emojiIdMarkup = emojiId
      ? `<span style="font-size:0.8em;opacity:0.75;">ID: ${emojiId}</span>`
      : "";
    const copyIdButton = emojiId
      ? `<button class="copy-id-btn" data-id-value="${emojiId}">ID</button>`
      : "";
    const rebuiltLink = canCopyRebuiltLink
      ? buildDiscordEmojiUrl(emojiId, normalizeDiscordEmojiName(emojiName) || "emoji", discordExtension)
      : "";
    const copyDiscordLinkButton = canCopyRebuiltLink
      ? `<button class="copy-discord-link-btn" data-discord-link="${rebuiltLink}">Discord</button>`
      : "";
    const div = document.createElement("div");
    div.className = "emoji-item";
    div.innerHTML = `
      <img src="${asset.image_url}" alt="${asset.name}" width="32" height="32">
      <div style="display:flex;flex-direction:column;min-width:0;">
        <span>${asset.name}</span>
        ${emojiIdMarkup}
      </div>
      <span style="font-size:0.9em;opacity:0.7;">[${asset.platform}]</span>
      <button class="copy-btn" data-url="${asset.image_url}">Copier URL</button>
      ${copyIdButton.replace('>ID<', '>Copier ID<')}
      ${copyDiscordLinkButton.replace('>Discord<', '>Copier lien Discord<')}
      <button class="copy-md-btn" data-url="${asset.image_url}" data-name="${asset.name}">Copier MD</button>
      <button class="copy-html-btn" data-url="${asset.image_url}" data-name="${asset.name}">Copier HTML</button>
      <button class="fav-btn" data-id="${asset.id}" style="color:${asset.is_favorite ? '#ffd700':'#aaa'}">⭐</button>
      <button class="delete-btn" data-id="${asset.id}">🗑️</button>
    `;
    assetListDiv.appendChild(div);
  });
}

function fetchAssets() {
  if (!USER_ID) return;
  let url = `${BACKEND_URL}/api/assets?user_id=${USER_ID}`;
  const platform = platformFilter.value;
  const fav = favFilter.checked;
  if (platform) url += `&platform=${platform}`;
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
platformFilter.addEventListener("change", fetchAssets);
favFilter.addEventListener("change", fetchAssets);

assetListDiv.addEventListener("click", e => {
  if (e.target.classList.contains("copy-btn")) {
    navigator.clipboard.writeText(e.target.dataset.url);
  }
  if (e.target.classList.contains("copy-id-btn")) {
    navigator.clipboard.writeText(e.target.dataset.idValue);
  }
  if (e.target.classList.contains("copy-discord-link-btn")) {
    navigator.clipboard.writeText(e.target.dataset.discordLink);
  }
  if (e.target.classList.contains("copy-md-btn")) {
    const url = e.target.dataset.url;
    const name = e.target.dataset.name;
    navigator.clipboard.writeText(`![${name}](${url})`);
  }
  if (e.target.classList.contains("copy-html-btn")) {
    const url = e.target.dataset.url;
    const name = e.target.dataset.name;
    navigator.clipboard.writeText(`<img src="${url}" alt="${name}">`);
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

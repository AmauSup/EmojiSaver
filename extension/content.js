// content.js — Script injecté dans Discord Web.
//
// Responsabilités :
//   1. Scanner le DOM pour les emojis Discord (images CDN et syntaxe markdown)
//   2. Observer les mutations du DOM via MutationObserver (Discord est une SPA React)
//   3. Envoyer les emojis détectés au service worker via chrome.runtime.sendMessage
//   4. Répondre aux messages de background.js (clic droit) et du popup (auto-save)

const AUTO_SYNC_STORAGE_KEY = "emotevault_auto_sync_enabled";
const AUTO_SYNC_SCAN_INTERVAL_MS = 5000;

let autoSyncEnabled = false;
let autoSyncObserver = null;
let autoSyncTimeout = null;
let autoSyncInterval = null;
let lastAutoSyncSignature = "";

// customEmoji : parse <:name:id> (statique) et <a:name:id> (animé) dans le texte des messages
// emojiCdnUrl : extrait l'ID et l'extension depuis une URL CDN Discord
const DISCORD_EMOJI_REGEX = {
  customEmoji: /<(?<animated>a?):(?<name>[\w-]+):(?<id>\d{15,25})>/g,
  emojiCdnUrl: /(?:cdn\.discordapp\.com|media\.discordapp\.net)\/emojis\/(?<id>\d{15,25})\.(?<extension>webp|png|gif|jpg|jpeg)/i,
  emojiName: /^:?(?<name>[\w-]+):?$/
};

function normalizeEmojiUrl(id, animated) {
  const extension = animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${id}.${extension}?size=48&quality=lossless`;
}

function getDiscordServerOrigin() {
  const pathSegments = globalThis.location.pathname.split("/").filter(Boolean);
  const isDiscordChannelsPath = pathSegments[0] === "channels";
  const guildId = isDiscordChannelsPath ? pathSegments[1] : null;
  const serverId = guildId && guildId !== "@me" ? guildId : null;

  if (!serverId) {
    return { server_id: null, server_name: null };
  }

  // Titre Discord : "#channel | Nom du serveur | Discord" ou "Nom du serveur | Discord"
  const pageTitle = (document.title || "").trim();
  const titleParts = pageTitle
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== "discord");

  let serverName = null;
  if (titleParts.length >= 2) {
    // Dernier élément restant = nom du serveur (après le nom du canal)
    serverName = titleParts.at(-1) || null;
  } else if (titleParts.length === 1 && !titleParts[0].startsWith("#")) {
    serverName = titleParts[0];
  }

  // Fallback DOM : item de navigation de la guilde dans la sidebar
  if (!serverName) {
    const guildNavItem = document.querySelector(`[data-list-item-id="guildsnav___${serverId}"]`);
    const navLabel = guildNavItem?.getAttribute("aria-label") || guildNavItem?.textContent;
    if (navLabel?.trim()) {
      serverName = navLabel.trim();
    }
  }

  return {
    server_id: serverId,
    server_name: serverName || null
  };
}

function getEmojiNameFromImage(img) {
  const candidates = [
    img.getAttribute("alt"),
    img.getAttribute("aria-label"),
    img.getAttribute("title")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.trim().match(DISCORD_EMOJI_REGEX.emojiName);
    if (match?.groups) {
      return match.groups.name;
    }
  }

  return "";
}

function scanEmojiImages(root = document) {
  const emojis = [];
  const serverOrigin = getDiscordServerOrigin();

  root.querySelectorAll("img[src*='/emojis/']").forEach((img) => {
    const match = img.src.match(DISCORD_EMOJI_REGEX.emojiCdnUrl);

    if (match?.groups) {
      const animated = match.groups.extension.toLowerCase() === "gif";
      emojis.push({
        id: match.groups.id,
        name: getEmojiNameFromImage(img),
        animated,
        url: normalizeEmojiUrl(match.groups.id, animated),
        source: "image",
        pageUrl: globalThis.location.href,
        ...serverOrigin
      });
    }
  });

  return emojis;
}

// Parse la syntaxe markdown Discord <:name:id> et <a:name:id> dans le texte brut des messages.
// Capture les emojis même quand ils ne sont pas rendus comme des images dans le DOM.
function extractFromText(text) {
  const results = [];
  const regex = new RegExp(DISCORD_EMOJI_REGEX.customEmoji);
  const serverOrigin = getDiscordServerOrigin();

  let match;
  while ((match = regex.exec(text)) !== null) {
    const { animated, name, id } = match.groups;
    const isAnimated = animated === "a";

    results.push({
      id,
      name,
      animated: isAnimated,
      url: normalizeEmojiUrl(id, isAnimated),
      source: "text",
      pageUrl: globalThis.location.href,
      ...serverOrigin
    });
  }

  return results;
}

// Extrait le nom du serveur depuis le header d'une section du picker.
// L'icône de guilde est entourée d'un conteneur frère qui contient le nom en texte.
function extractServerNameFromPickerHeader(iconImg) {
  let container = iconImg.parentElement;
  for (let depth = 0; depth < 5 && container; depth++) {
    for (const child of container.children) {
      if (child.contains(iconImg)) continue;
      if (child.querySelector("img")) continue;
      const text = child.textContent?.trim();
      if (text && text.length > 0 && text.length < 150) {
        return text;
      }
    }
    container = container.parentElement;
  }
  return null;
}

// Scanne le picker d'emojis Discord en associant chaque emoji à son serveur d'origine.
// Les icônes de guilde (cdn.discordapp.com/icons/{guildId}/...) marquent le début
// de chaque section de serveur ; on les utilise pour extraire server_id et server_name.
function scanEmojiPickerWithServers() {
  const picker = document.querySelector('[class*="emojiPicker"]');
  if (!picker) return [];

  const emojis = [];
  let currentServerId = null;
  let currentServerName = null;

  for (const img of picker.querySelectorAll("img")) {
    const src = img.getAttribute("src") || "";

    const iconMatch = src.match(/(?:cdn|media)\.discordapp\.(?:com|net)\/icons\/(\d{15,25})\//);
    if (iconMatch) {
      currentServerId = iconMatch[1];
      currentServerName = extractServerNameFromPickerHeader(img);
      continue;
    }

    const emojiMatch = src.match(DISCORD_EMOJI_REGEX.emojiCdnUrl);
    if (emojiMatch?.groups) {
      const { id, extension } = emojiMatch.groups;
      const animated = extension.toLowerCase() === "gif";
      emojis.push({
        id,
        name: getEmojiNameFromImage(img),
        animated,
        url: normalizeEmojiUrl(id, animated),
        source: "emoji-picker",
        pageUrl: globalThis.location.href,
        server_id: currentServerId,
        server_name: currentServerName
      });
    }
  }

  return emojis;
}

// Cherche l'emoji donné dans le picker et retourne son serveur d'origine via le header de section.
function getServerOriginForEmojiInPicker(emojiUrl) {
  const picker = document.querySelector('[class*="emojiPicker"]');
  if (!picker) return null;

  const emojiUrlBase = emojiUrl.split("?")[0];
  let currentServerId = null;
  let currentServerName = null;

  for (const img of picker.querySelectorAll("img")) {
    const src = img.getAttribute("src") || "";

    const iconMatch = src.match(/(?:cdn|media)\.discordapp\.(?:com|net)\/icons\/(\d{15,25})\//);
    if (iconMatch) {
      currentServerId = iconMatch[1];
      currentServerName = extractServerNameFromPickerHeader(img);
      continue;
    }

    if (src === emojiUrl || src.split("?")[0] === emojiUrlBase) {
      if (currentServerId) {
        return { server_id: currentServerId, server_name: currentServerName };
      }
    }
  }

  return null;
}

function collectVisibleDiscordEmojis(root = document) {
  const fromImages = scanEmojiImages(root);
  const fromText = extractFromText(document.body?.innerText || "");
  const fromPicker = scanEmojiPickerWithServers();
  const byId = new Map();

  // Merge des trois sources : fromPicker est traité en dernier car son association
  // serveur (issue du sélecteur d'emojis) est plus précise et doit écraser les autres.
  [...fromImages, ...fromText, ...fromPicker].forEach((emoji) => {
    const previous = byId.get(emoji.id) || {};
    byId.set(emoji.id, {
      ...previous,
      ...emoji,
      name: emoji.name || previous.name || ""
    });
  });

  return Array.from(byId.values());
}

// Construit une empreinte de l'état courant des emojis visibles.
// Permet d'éviter un appel API si rien n'a changé depuis la dernière sync.
function buildEmojiSignature(emojis) {
  return emojis
    .map((emoji) => `${emoji.id}:${emoji.name || ""}:${emoji.animated ? "1" : "0"}:${emoji.server_id || ""}:${emoji.server_name || ""}`)
    .sort()
    .join("|");
}

function sendVisibleDiscordEmojisToBackground() {
  if (!autoSyncEnabled) {
    return;
  }

  const emojis = collectVisibleDiscordEmojis();
  if (emojis.length === 0) {
    return;
  }

  const signature = buildEmojiSignature(emojis);
  if (signature === lastAutoSyncSignature) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "SAVE_DISCORD_EMOJIS",
    emojis
  }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }

    if (response?.success) {
      lastAutoSyncSignature = signature;
    }
  });
}

// Debounce de 900 ms : regroupe les mutations DOM rapides en un seul scan.
// Évite d'appeler collectVisibleDiscordEmojis à chaque mutation individuelle.
function scheduleAutoSync() {
  if (!autoSyncEnabled) {
    return;
  }

  globalThis.clearTimeout(autoSyncTimeout);
  autoSyncTimeout = globalThis.setTimeout(() => {
    sendVisibleDiscordEmojisToBackground();
  }, 900);
}

function startAutoSyncObserver() {
  if (autoSyncObserver || !document.body) {
    return;
  }

  // MutationObserver sur tout le body pour détecter les changements de contenu.
  // subtree: true capture les modifications à n'importe quelle profondeur du DOM.
  // attributeFilter limite les déclenchements aux attributs portant les métadonnées d'emojis.
  autoSyncObserver = new MutationObserver(scheduleAutoSync);
  autoSyncObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "alt", "aria-label", "title"]
  });

  scheduleAutoSync();

  if (!autoSyncInterval) {
    autoSyncInterval = globalThis.setInterval(sendVisibleDiscordEmojisToBackground, AUTO_SYNC_SCAN_INTERVAL_MS);
  }
}

function stopAutoSyncObserver() {
  globalThis.clearTimeout(autoSyncTimeout);
  autoSyncTimeout = null;
  lastAutoSyncSignature = "";

  if (autoSyncInterval) {
    globalThis.clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }

  if (autoSyncObserver) {
    autoSyncObserver.disconnect();
    autoSyncObserver = null;
  }
}

function setAutoSyncEnabled(enabled) {
  autoSyncEnabled = enabled;

  if (autoSyncEnabled) {
    startAutoSyncObserver();
    sendVisibleDiscordEmojisToBackground();
  } else {
    stopAutoSyncObserver();
  }
}

function loadAutoSyncSetting() {
  chrome.storage.local.get([AUTO_SYNC_STORAGE_KEY], (result) => {
    setAutoSyncEnabled(!!result[AUTO_SYNC_STORAGE_KEY]);
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[AUTO_SYNC_STORAGE_KEY]) {
    return;
  }

  setAutoSyncEnabled(!!changes[AUTO_SYNC_STORAGE_KEY].newValue);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "emotevault:auto-sync:set") {
    const enabled = !!request.enabled;
    chrome.storage.local.set({ [AUTO_SYNC_STORAGE_KEY]: enabled }, () => {
      setAutoSyncEnabled(enabled);
      sendResponse({ success: true, enabled });
    });
    return true;
  }

  return false;
});

// Discord est une SPA : document.body peut ne pas exister au moment de l'injection du script.
// On attend sa disponibilité par polling avant de démarrer l'auto-sync.
function bootAutoSyncWhenReady() {
  if (!document.body) {
    globalThis.setTimeout(bootAutoSyncWhenReady, 250);
    return;
  }

  loadAutoSyncSetting();
}

function detectPlatform(url) {
  if (/cdn.discordapp.com|media.discordapp.net/.test(url)) return "discord";
  if (/twitch.tv|jtvnw.net|twimg.com/.test(url)) return "twitch";
  if (/youtube.com|ytimg.com|googleusercontent.com/.test(url)) return "youtube";
  if (/reddit.com|redd.it/.test(url)) return "reddit";
  return "other";
}

function detectAssetType(url) {
  if (/\.gif($|\?)/i.test(url)) return "gif";
  if (/emote|emoji/i.test(url)) return "emoji";
  if (/\.png|\.jpg|\.jpeg|\.webp/i.test(url)) return "image";
  return "image";
}

function isAnimated(url) {
  return /\.gif($|\?)/i.test(url);
}

function getDiscordEmojiMetaFromUrl(image_url) {
  if (!/cdn.discordapp.com\/emojis\/(\d+)/.test(image_url)) {
    return { emoji_id: null, emoji_name: null };
  }

  const match = image_url.match(/emojis\/(\d+)(?:\.[a-z]+)?/);
  const emoji_id = match ? match[1] : null;
  const imgs = document.querySelectorAll(`img[src='${image_url}']`);

  if (imgs.length === 0) {
    return { emoji_id, emoji_name: null };
  }

  const alt = imgs[0].alt || "";
  const altName = alt.replaceAll(":", "").trim();
  const emoji_name = altName || null;
  return { emoji_id, emoji_name, imgNode: imgs[0] };
}

function sendAssetToBackground(asset) {
  chrome.runtime.sendMessage({ type: "SAVE_ASSET", asset }, (response) => {
    if (!response?.success) {
      console.error("EmoteVault save failed:", response?.error);
    }
  });
}

function handleSaveAsset(srcUrl) {
  const image_url = srcUrl;
  const platform = detectPlatform(image_url);
  const animated = isAnimated(image_url);
  let name = "unknown";
  const serverOrigin = getServerOriginForEmojiInPicker(image_url) || getDiscordServerOrigin();

  if (platform === "discord") {
    const meta = getDiscordEmojiMetaFromUrl(image_url);
    const altName = meta.imgNode?.alt?.replaceAll(":", "").trim();
    name = altName || meta.imgNode?.title?.trim() || "unknown";
  } else {
    const imgs = document.querySelectorAll(`img[src='${image_url}']`);
    if (imgs.length > 0) {
      name = imgs[0].alt?.replaceAll(":", "").trim() || imgs[0].title?.trim() || "unknown";
    }
  }

  sendAssetToBackground({
    image_url,
    platform,
    server_id: serverOrigin.server_id,
    server_name: serverOrigin.server_name,
    name,
    is_animated: animated
  });
}

function handleCopyDiscordFormat(srcUrl) {
  const image_url = srcUrl;
  const platform = detectPlatform(image_url);
  const animated = isAnimated(image_url);

  if (platform !== "discord") {
    alert("This is not a custom Discord emoji.");
    return;
  }

  const { emoji_id, emoji_name } = getDiscordEmojiMetaFromUrl(image_url);

  if (!emoji_id || !emoji_name) {
    alert("Could not detect Discord format for this emoji.");
    return;
  }

  const discord_format = animated ? `<a:${emoji_name}:${emoji_id}>` : `<:${emoji_name}:${emoji_id}>`;
  navigator.clipboard.writeText(discord_format).then(() => {
    alert("Discord format copied: " + discord_format);
  }, () => {
    alert("Could not copy to clipboard.");
  });
}

function handleExtractServerEmojis(sendResponse) {
  try {
    const emojis = collectVisibleDiscordEmojis();
    sendResponse({ success: true, emojis, count: emojis.length });
  } catch (error) {
    sendResponse({ success: false, error: error?.message || "Extraction impossible." });
  }
}

// Messages envoyés par background.js (clic droit) et popup.js (extraction manuelle).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "emotevault_save_asset" && request.srcUrl) {
    handleSaveAsset(request.srcUrl);
  } else if (request.action === "emotevault_copy_discord_format" && request.srcUrl) {
    handleCopyDiscordFormat(request.srcUrl);
  } else if (request.action === "emotevault_extract_server_emojis") {
    handleExtractServerEmojis(sendResponse);
  }

  return false;
});

bootAutoSyncWhenReady();

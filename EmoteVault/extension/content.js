// EmoteVault - content.js
// Intercepte le clic droit sur une image, détecte la plateforme/type, et envoie au backend

const BACKEND_URL = "http://localhost:3000";
const DEMO_USER_ID = "demo-user-123";

const DISCORD_EMOJI_REGEX = {
  customEmoji: /<(?<animated>a?):(?<name>[\w-]+):(?<id>\d{15,25})>/g,
  emojiCdnUrl: /(?:cdn\.discordapp\.com|media\.discordapp\.net)\/emojis\/(?<id>\d{15,25})\.(?<extension>webp|png|gif|jpg|jpeg)/i,
  emojiName: /^:?(?<name>[\w-]+):?$/
};

function normalizeEmojiUrl(id, animated) {
  const extension = animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${id}.${extension}?size=48&quality=lossless`;
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
        pageUrl: globalThis.location.href
      });
    }
  });

  return emojis;
}

function extractFromText(text) {
  const results = [];
  const regex = new RegExp(DISCORD_EMOJI_REGEX.customEmoji);

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
      pageUrl: globalThis.location.href
    });
  }

  return results;
}

function collectVisibleDiscordEmojis(root = document) {
  const fromImages = scanEmojiImages(root);
  const fromText = extractFromText(document.body?.innerText || "");
  const byId = new Map();

  [...fromImages, ...fromText].forEach((emoji) => {
    const previous = byId.get(emoji.id) || {};
    byId.set(emoji.id, {
      ...previous,
      ...emoji,
      name: emoji.name || previous.name || ""
    });
  });

  return Array.from(byId.values());
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
    if (response?.success) {
      alert("Asset sauvegardé dans EmoteVault !");
    } else {
      alert("Erreur réseau ou serveur EmoteVault." + (response?.error ? ("\n" + response.error) : ""));
    }
  });
}

function handleSaveAsset(srcUrl) {
  const image_url = srcUrl;
  const page_url = globalThis.location.href;
  const platform = detectPlatform(image_url);
  const asset_type = detectAssetType(image_url);
  const animated = isAnimated(image_url);
  let name = "unknown";
  let emoji_id = null;
  let emoji_name = null;
  let discord_format = null;

  if (platform === "discord") {
    const meta = getDiscordEmojiMetaFromUrl(image_url);
    emoji_id = meta.emoji_id;
    emoji_name = meta.emoji_name;
    const altName = meta.imgNode?.alt?.replaceAll(":", "").trim();
    name = altName || meta.imgNode?.title?.trim() || "unknown";

    if (emoji_id && emoji_name) {
      discord_format = animated ? `<a:${emoji_name}:${emoji_id}>` : `<:${emoji_name}:${emoji_id}>`;
    }
  } else {
    const imgs = document.querySelectorAll(`img[src='${image_url}']`);
    if (imgs.length > 0) {
      name = imgs[0].alt?.replaceAll(":", "").trim() || imgs[0].title?.trim() || "unknown";
    }
  }

  sendAssetToBackground({
    image_url,
    page_url,
    platform,
    asset_type,
    name,
    is_animated: animated,
    emoji_id,
    emoji_name,
    discord_format
  });
}

function handleCopyDiscordFormat(srcUrl) {
  const image_url = srcUrl;
  const platform = detectPlatform(image_url);
  const animated = isAnimated(image_url);

  if (platform !== "discord") {
    alert("Ce n'est pas un emoji custom Discord.");
    return;
  }

  const { emoji_id, emoji_name } = getDiscordEmojiMetaFromUrl(image_url);

  if (!emoji_id || !emoji_name) {
    alert("Impossible de détecter le format Discord pour cet emoji.");
    return;
  }

  const discord_format = animated ? `<a:${emoji_name}:${emoji_id}>` : `<:${emoji_name}:${emoji_id}>`;
  navigator.clipboard.writeText(discord_format).then(() => {
    alert("Format Discord copié : " + discord_format);
  }, () => {
    alert("Impossible de copier dans le presse-papier.");
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

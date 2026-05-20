// EmoteVault - content.js
// Intercepte le clic droit sur une image, détecte la plateforme/type, et envoie au backend

const BACKEND_URL = "http://localhost:3000";
const DEMO_USER_ID = "demo-user-123";

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "emotevault_save_asset" && request.srcUrl) {
    const image_url = request.srcUrl;
    const page_url = window.location.href;
    const platform = detectPlatform(image_url);
    const asset_type = detectAssetType(image_url);
    const animated = isAnimated(image_url);
    let name = "unknown";
    let emoji_id = null;
    let emoji_name = null;
    let discord_format = null;
    // Détection emoji Discord custom
    if (platform === "discord" && /cdn.discordapp.com\/emojis\/(\d+)/.test(image_url)) {
      // Extrait l'id depuis l'URL
      const match = image_url.match(/emojis\/(\d+)(?:\.[a-z]+)?/);
      if (match) {
        emoji_id = match[1];
      }
      // Essaye de récupérer le nom depuis l'attribut alt ou title
      const imgs = document.querySelectorAll(`img[src='${image_url}']`);
      if (imgs.length > 0) {
        // alt=":blobdance:"
        const alt = imgs[0].alt || "";
        const altName = alt.replaceAll(":", "").trim();
        name = altName || imgs[0].title?.trim() || "unknown";
        emoji_name = altName || null;
      }
      // Format Discord
      if (emoji_id && emoji_name) {
        discord_format = animated ? `<a:${emoji_name}:${emoji_id}>` : `<:${emoji_name}:${emoji_id}>`;
      }
    } else {
      // Emoji unicode ou image classique
      const imgs = document.querySelectorAll(`img[src='${image_url}']`);
      if (imgs.length > 0) {
        name = imgs[0].alt?.replaceAll(":", "").trim() || imgs[0].title?.trim() || "unknown";
      }
    }
    // Envoie la demande de sauvegarde au background script
    chrome.runtime.sendMessage({
      type: "SAVE_ASSET",
      asset: {
        image_url,
        page_url,
        platform,
        asset_type,
        name,
        is_animated: animated,
        emoji_id,
        emoji_name,
        discord_format
      }
    }, (response) => {
      if (response?.success) {
        alert("Asset sauvegardé dans EmoteVault !");
      } else {
        alert("Erreur réseau ou serveur EmoteVault." + (response?.error ? ("\n" + response.error) : ""));
      }
    });
  } else if (request.action === "emotevault_copy_discord_format" && request.srcUrl) {
    // Copie le format Discord dans le presse-papier si c'est un emoji custom Discord
    const image_url = request.srcUrl;
    const platform = detectPlatform(image_url);
    const animated = isAnimated(image_url);
    let emoji_id = null;
    let emoji_name = null;
    let discord_format = null;
    if (platform === "discord" && /cdn.discordapp.com\/emojis\/(\d+)/.test(image_url)) {
      const match = image_url.match(/emojis\/(\d+)(?:\.[a-z]+)?/);
      if (match) {
        emoji_id = match[1];
      }
      const imgs = document.querySelectorAll(`img[src='${image_url}']`);
      if (imgs.length > 0) {
        const alt = imgs[0].alt || "";
        const altName = alt.replaceAll(":", "").trim();
        emoji_name = altName || null;
      }
      if (emoji_id && emoji_name) {
        discord_format = animated ? `<a:${emoji_name}:${emoji_id}>` : `<:${emoji_name}:${emoji_id}>`;
        navigator.clipboard.writeText(discord_format).then(() => {
          alert("Format Discord copié : " + discord_format);
        }, () => {
          alert("Impossible de copier dans le presse-papier.");
        });
      } else {
        alert("Impossible de détecter le format Discord pour cet emoji.");
      }
    } else {
      alert("Ce n'est pas un emoji custom Discord.");
    }
  }
});

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
    const match = candidate.trim().match(window.DiscordEmojiRegex.emojiName);
    if (match && match.groups) {
      return match.groups.name;
    }
  }

  return "";
}

function scanEmojiImages(root = document) {
  const emojis = [];

  root.querySelectorAll("img[src*='/emojis/']").forEach((img) => {
    const match = img.src.match(window.DiscordEmojiRegex.emojiCdnUrl);

    if (match && match.groups) {
      const animated = match.groups.extension.toLowerCase() === "gif";

      emojis.push({
        id: match.groups.id,
        name: getEmojiNameFromImage(img),
        url: normalizeEmojiUrl(match.groups.id, animated),
        animated,
        source: "image"
      });
    }
  });

  return emojis;
}

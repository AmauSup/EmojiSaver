function extractFromText(text) {
  const results = [];
  const regex = new RegExp(window.DiscordEmojiRegex.customEmoji);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const { animated, name, id } = match.groups;
    const isAnimated = animated === "a";

    results.push({
      name,
      id,
      animated: isAnimated,
      url: normalizeEmojiUrl(id, isAnimated),
      source: "text"
    });
  }

  return results;
}

async function extractVisibleDiscordEmojis(root = document) {
  const fromImages = scanEmojiImages(root);
  const fromText = extractFromText(document.body.innerText || "");
  const byId = new Map();

  [...fromImages, ...fromText].forEach((emoji) => {
    const previous = byId.get(emoji.id) || {};
    byId.set(emoji.id, {
      ...previous,
      ...emoji,
      name: emoji.name || previous.name || ""
    });
  });

  const emojis = Array.from(byId.values());

  if (emojis.length === 0) {
    return [];
  }

  return browser.runtime.sendMessage({
    type: "emojis:found",
    emojis
  });
}

const storageApi = browser.storage.local;

async function getEmojis() {
  const result = await storageApi.get("emojis");
  return result.emojis || [];
}

async function saveEmojis(emojis) {
  await storageApi.set({ emojis });
  await updateBadge(emojis.length);
}

async function updateBadge(count) {
  await browser.browserAction.setBadgeText({
    text: count > 0 ? String(count) : ""
  });

  await browser.browserAction.setBadgeBackgroundColor({
    color: "#5865f2"
  });
}

async function mergeEmojis(foundEmojis) {
  const existing = await getEmojis();
  const byId = new Map(existing.map((emoji) => [emoji.id, emoji]));

  foundEmojis.forEach((emoji) => {
    const previous = byId.get(emoji.id) || {};
    byId.set(emoji.id, {
      ...previous,
      ...emoji,
      name: emoji.name || previous.name || "",
      firstSeenAt: previous.firstSeenAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  });

  const emojis = Array.from(byId.values()).sort((a, b) => {
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  await saveEmojis(emojis);
  return emojis;
}

browser.runtime.onInstalled.addListener(async () => {
  await updateBadge((await getEmojis()).length);
});

browser.runtime.onStartup.addListener(async () => {
  await updateBadge((await getEmojis()).length);
});

browser.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "emojis:found") {
    return mergeEmojis(message.emojis || []);
  }

  if (message.type === "emojis:get") {
    return getEmojis();
  }

  if (message.type === "emojis:clear") {
    return saveEmojis([]);
  }

  return false;
});

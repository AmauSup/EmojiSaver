const storageApi = browser.storage.local;

window.DiscordEmojiStorage = {
  async getEmojis() {
    const result = await storageApi.get("emojis");
    return result.emojis || [];
  },

  async saveEmojis(emojis) {
    await storageApi.set({ emojis });
  },

  async mergeEmojis(foundEmojis) {
    const existing = await this.getEmojis();
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

    await this.saveEmojis(emojis);
    return emojis;
  },

  async clearEmojis() {
    await storageApi.set({ emojis: [] });
  }
};

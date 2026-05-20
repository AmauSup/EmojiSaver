window.DiscordEmojiRegex = {
  customEmoji: /<(?<animated>a?):(?<name>[\w-]+):(?<id>\d{15,25})>/g,
  emojiCdnUrl: /(?:cdn\.discordapp\.com|media\.discordapp\.net)\/emojis\/(?<id>\d{15,25})\.(?<extension>webp|png|gif|jpg|jpeg)/i,
  emojiName: /^:?(?<name>[\w-]+):?$/
};

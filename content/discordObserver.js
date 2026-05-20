let scanTimeout = null;

function scheduleEmojiScan() {
  window.clearTimeout(scanTimeout);
  scanTimeout = window.setTimeout(() => {
    extractVisibleDiscordEmojis().catch((error) => {
      console.error("Discord Emoji Extractor scan failed:", error);
    });
  }, 500);
}

function startDiscordObserver() {
  if (!document.body) {
    window.setTimeout(startDiscordObserver, 250);
    return;
  }

  const observer = new MutationObserver(scheduleEmojiScan);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "alt", "aria-label", "title"]
  });

  scheduleEmojiScan();
}

startDiscordObserver();

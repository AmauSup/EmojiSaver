// EmoteVault - background.js
// Service Worker pour gérer le menu contextuel et la communication avec le content script

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "emotevault-save-asset",
    title: "Save to EmoteVault",
    contexts: ["image"]
  });
  chrome.contextMenus.create({
    id: "emotevault-copy-discord-format",
    title: "Copy Discord format (<:name:id>)",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "emotevault-save-asset") {
    chrome.tabs.sendMessage(tab.id, {
      action: "emotevault_save_asset",
      srcUrl: info.srcUrl
    });
  } else if (info.menuItemId === "emotevault-copy-discord-format") {
    chrome.tabs.sendMessage(tab.id, {
      action: "emotevault_copy_discord_format",
      srcUrl: info.srcUrl
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SAVE_ASSET" && request.asset) {
    chrome.storage.local.get(["emotevault_user_id"], (result) => {
      const user_id = result.emotevault_user_id;
      if (!user_id) {
        sendResponse({ success: false, error: "User not logged in." });
        return;
      }
      const { image_url, platform, name, server_id, server_name, is_animated } = request.asset;
      fetch("http://localhost:3000/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, image_url, platform, name, server_id, server_name, is_animated })
      })
        .then(async (res) => {
          if (res.ok) {
            sendResponse({ success: true });
            return;
          }
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: data.error || res.status });
        })
        .catch((err) => sendResponse({ success: false, error: err.toString() }));
    });
    return true;
  }

  if (request.type === "SAVE_DISCORD_EMOJIS" && Array.isArray(request.emojis)) {
    chrome.storage.local.get(["emotevault_user_id"], async (result) => {
      const user_id = result.emotevault_user_id;
      if (!user_id) {
        sendResponse({ success: false, error: "User not logged in." });
        return;
      }

      let saved = 0;
      let duplicates = 0;
      let failed = 0;

      for (const emoji of request.emojis) {
        const payload = {
          user_id,
          image_url: emoji.url,
          platform: "discord",
          name: emoji.name || `emoji_${emoji.id}`,
          server_id: emoji.server_id || null,
          server_name: emoji.server_name || null,
          is_animated: !!emoji.animated
        };

        try {
          const res = await fetch("http://localhost:3000/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            saved += 1;
          } else if (res.status === 409) {
            duplicates += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }

      sendResponse({ success: true, saved, duplicates, failed });
    });
    return true;
  }
});

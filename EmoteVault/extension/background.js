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
    title: "Copier format Discord (<:name:id>)",
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

// Réceptionne la demande de sauvegarde d'asset depuis le content script et effectue le POST réseau
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SAVE_ASSET" && request.asset) {
    // Récupère l'user_id depuis le storage
    chrome.storage.local.get(["emotevault_user_id"], (result) => {
      const user_id = result.emotevault_user_id;
      if (!user_id) {
        sendResponse({ success: false, error: "Utilisateur non connecté." });
        return;
      }
      const asset = { ...request.asset, user_id };
      fetch("http://localhost:3000/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset)
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            sendResponse({ success: false, error: data.error || res.status });
          } else {
            sendResponse({ success: true });
          }
        })
        .catch((err) => sendResponse({ success: false, error: err.toString() }));
    });
    return true; // Indique réponse asynchrone
  }
});

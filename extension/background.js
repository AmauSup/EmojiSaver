// background.js — Service worker EmoteVault (Manifest V3).
//
// Responsabilités :
//   1. Enregistrer le menu contextuel (clic droit sur une image)
//   2. Relayer les actions vers l'API backend (content.js délègue les appels réseau ici)
//   3. Sauvegarder les emojis unitairement (SAVE_ASSET) ou en lot (SAVE_DISCORD_EMOJIS)
//
// Contrainte MV3 : le service worker peut s'endormir entre deux événements.
// Aucun état ne doit être conservé en mémoire entre les appels.
// TODO: externaliser BACKEND_URL (actuellement codé en dur à http://localhost:3000)

// Les menus contextuels doivent être (re)créés dans onInstalled.
// En MV3, le service worker peut redémarrer et perdre les menus s'ils sont créés ailleurs.
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

// Le service worker ne peut pas accéder au DOM directement.
// Il délègue l'action au content script via chrome.tabs.sendMessage.
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
  // SAVE_ASSET : sauvegarde un emoji unique (clic droit ou Discord Builder).
  // L'user_id est lu depuis chrome.storage.local (pas de JWT pour l'instant).
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
    // return true est obligatoire pour garder le canal sendResponse ouvert
    // après une opération asynchrone (fetch + chrome.storage) en MV3.
    return true;
  }

  // SAVE_DISCORD_EMOJIS : sauvegarde en lot depuis l'auto-sync du content script.
  // Les 409 (doublon déjà sauvegardé) sont comptés mais ignorés silencieusement.
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
    return true; // canal sendResponse ouvert pour la réponse asynchrone
  }
});

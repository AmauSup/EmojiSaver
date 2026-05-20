# Discord Emoji Extractor

Extension Firefox temporaire pour recuperer les IDs des emojis custom visibles sur Discord.

## Installation dans Firefox

1. Ouvre `about:debugging#/runtime/this-firefox`.
2. Clique sur `Charger un module complementaire temporaire`.
3. Selectionne le fichier `manifest.json` de ce dossier.
4. Ouvre `https://discord.com`.
5. Va dans un salon qui contient des emojis custom.
6. Clique sur l'icone de l'extension pour voir et copier les IDs recuperes.

## Fonctionnement

- Le content script scanne les images d'emojis visibles sur Discord.
- Le background script dedoublonne et stocke les emojis dans `browser.storage.local`.
- La popup affiche la liste, permet de copier les IDs, copier le JSON, ou vider le stockage.

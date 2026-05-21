# EmoteVault Extension (MVP)

Extension navigateur WebExtension pour sauvegarder et réutiliser des emojis, emotes, GIFs et images depuis Discord, Twitch, YouTube, Reddit ou tout site web.

## Installation

1. Ouvrez Chrome/Edge/Brave → Extensions → Mode développeur → Charger l’extension non empaquetée → Sélectionnez le dossier `/extension`.
2. Vérifiez que le backend tourne sur http://localhost:3000.
3. Faites clic droit sur une image, GIF, emote ou emoji → “Save to EmoteVault”.
4. Ouvrez la popup de l’extension pour voir vos assets sauvegardés, filtrer, copier, supprimer, marquer en favori.

## Fonctionnalités
- Menu clic droit “Save to EmoteVault” sur toute image
- Détection automatique de la plateforme (Discord, Twitch, YouTube, Reddit, Other)
- Détection du type d’asset (emoji, emote, gif, image)
- Sauvegarde de l’URL, du nom, de la page, du type, de la plateforme
- Popup : liste, recherche, filtre plateforme, filtre favoris, copier URL/Markdown/HTML, suppression, favoris

## Notes
- Ne contourne aucune restriction payante ou d’abonnement
- Ne sauvegarde que les liens accessibles dans le navigateur
- Code vanilla JS, Manifest V3, compatible web-ext

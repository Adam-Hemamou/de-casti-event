# De Casti Event — maquette 2 (référence pour le développement)

Ce dossier est la maquette validée du site, en HTML statique. Il sert de référence visuelle et de source de contenu pour coder le site avec Astro (voir `PROMPT-CLAUDE-CODE.md`).

## Contenu

- `pages/` : les 4 pages (accueil, agence, dj, contact). Ouvrir un fichier dans le navigateur pour le voir.
- `pages/popups/` : les 9 pop-up (4 agence, 5 DJ). Ils s'ouvrent depuis les boutons « En savoir plus » (agence) et « Voir les formules » (DJ).
- `photos/` : les 20 photos du client, déjà étalonnées (tons chauds). Ce sont les seules images à utiliser.
- `theme/palettes.css` : les couleurs, sous forme de variables CSS, avec deux palettes.
- `theme/theme-switch.js` : petit sélecteur d'aperçu (en bas à droite). Il n'est **pas** à reproduire dans le site.

## Les deux palettes

La structure, les formes et le contenu ne changent pas ; seules les couleurs changent.

| Palette | Attribut | Origine |
|---|---|---|
| Bordeaux & champagne (par défaut) | `data-theme="bordeaux"` sur `<html>` | maquette 2 |
| Noir & or | `data-theme="noir-or"` sur `<html>` | maquette 1 |

Aperçu : ajouter `?theme=noir-or` à l'adresse d'une page, ou utiliser le sélecteur.

Les pages n'utilisent aucune couleur en dur : tout passe par les variables de `palettes.css`. Pour créer une troisième palette, il suffit de copier un bloc `:root[data-theme=…]` et de changer les valeurs.

## Typographie

- Titres : Bodoni Moda (400 / 500, droit et italique)
- Texte : Instrument Sans (400 / 500 / 600)

## Contenu à compléter avec le client

- Coordonnées : e-mail, téléphone, ville, horaires (`[… à confirmer]`)
- Réponses de la FAQ (page contact)
- Pop-up DJ « Festivals & événements publics » et « Sport, marques & événements spéciaux » : formules, tarifs, options
- Liens des réseaux sociaux, de la vidéo, de « Lire tous les avis » et « Voir plus de photos & vidéos »

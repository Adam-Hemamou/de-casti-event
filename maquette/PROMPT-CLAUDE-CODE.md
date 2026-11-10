Tu vas coder le site vitrine De Casti Event (agence événementielle & DJ Eva de Casti) avec Astro, en site 100 % statique hébergé sur Netlify.

## 1. Avant de coder

La maquette validée est dans le dossier `maquette/` à la racine. Lis d'abord `maquette/README.md`, puis ouvre chaque fichier de `maquette/pages/` et `maquette/pages/popups/`. Cette maquette fait foi pour la structure, la mise en page, les formes, les espacements, la typographie et tout le texte : reproduis-la fidèlement, sans inventer de contenu ni de section.

Si le projet Astro n'existe pas encore, crée-le dans le dossier courant (`npm create astro@latest`, modèle minimal, TypeScript strict), sans écraser le dossier `maquette/`.

Dépendances autorisées, et rien d'autre sans me demander :
- `astro`, `@astrojs/sitemap`
- `gsap` (animations), `lenis` (défilement doux)
- `@fontsource/bodoni-moda`, `@fontsource/instrument-sans` (polices auto-hébergées, pas de Google Fonts en CDN, pour le RGPD)

Pas de React, pas de Tailwind, pas de librairie UI. CSS natif (fichiers `.css` ou `<style>` scopés dans les composants).

Commence par me proposer l'arborescence (pages, layouts, composants, fichiers de contenu) et attends mon accord avant de coder.

## 2. Pages

- `/` Accueil (`maquette/pages/accueil.html`)
- `/agence-evenementielle` (`maquette/pages/agence.html`)
- `/dj` (`maquette/pages/dj.html`)
- `/contact` (`maquette/pages/contact.html`)
- `/merci` : page de confirmation après l'envoi du formulaire, dans le même style
- `/mentions-legales` et `/politique-de-confidentialite` : pages simples avec un contenu `[à rédiger]`
- Une page 404 dans le même style

Un seul layout `BaseLayout.astro` avec l'en-tête, le pied de page, les métadonnées SEO et le script d'animations.

## 3. Contenu modifiable (pas de CMS)

C'est moi qui ferai les modifications demandées par la cliente. Tout le texte, les tarifs, les avis, les listes et les coordonnées doivent donc être dans des fichiers de données séparés du design, dans `src/data/` :
- un fichier par page (`accueil.json`, `agence.json`, `dj.json`, `contact.json`)
- `popups.json` (les 9 pop-up : textes, prestations, étapes, formules, prix, options)
- `avis.json`, `site.json` (nom, coordonnées, réseaux sociaux, navigation)

Les composants ne contiennent aucun texte en dur. Type les données avec des interfaces TypeScript (ou des content collections Astro avec un schéma Zod) pour qu'une erreur de saisie bloque le build au lieu de casser une page. Changer un prix doit se résumer à modifier une valeur dans `popups.json`.

## 4. Couleurs et palettes

- Copie `maquette/theme/palettes.css` dans `src/styles/`. Toutes les couleurs du site passent par ces variables CSS, aucune couleur en dur dans les composants.
- Deux palettes existent : `bordeaux` (par défaut) et `noir-or`, sélectionnées par l'attribut `data-theme` sur `<html>`. La palette active est définie dans `src/config/theme.ts` (une seule ligne à changer). Le layout pose l'attribut au build.
- Ne reproduis pas le sélecteur flottant de `theme-switch.js`, il ne sert qu'à l'aperçu de la maquette.

## 5. Composants

En-tête avec navigation (lien actif en italique, menu burger accessible sur mobile), pied de page (le grand « De Casti Event » s'adapte à la largeur), boutons (plein, contour, lien souligné), en-tête de section, carte d'expertise, citation d'avis, galerie, liste d'étapes numérotées, carte de formule tarifaire, disque vinyle de l'accueil.

## 6. Pop-up

Les 9 fichiers de `maquette/pages/popups/` sont des fenêtres modales qui s'ouvrent par-dessus la page. Utilise l'élément natif `<dialog>` avec `showModal()` : fond assombri, fermeture par la croix, Échap et clic sur le fond, focus rendu au bouton à la fermeture. Un seul composant `Popup.astro` avec deux variantes : « prestations » (agence) et « formules » (DJ, cartes tarifs avec la formule « La plus choisie » mise en avant). Les boutons « En savoir plus » (Agence) et « Voir les formules » (DJ) ouvrent le bon pop-up (le `href` de chaque bouton dans la maquette indique lequel). Chaque pop-up a une ancre (`/dj#formules-mariages`) pour pouvoir partager un lien qui l'ouvre directement. Le bouton d'action du pop-up mène au formulaire de contact avec le type d'événement présélectionné.

## 7. Animations

- Transitions entre les pages avec le `ClientRouter` d'Astro : fondu doux, en-tête et pied de page qui restent en place.
- GSAP + ScrollTrigger :
  - titres en Bodoni qui se révèlent au scroll (montée légère + fondu, ligne par ligne pour les grands titres) ;
  - textes et cartes qui apparaissent en léger décalé ;
  - parallaxe discret sur les grandes photos (bannières, À propos, panneaux) ;
  - chiffres clés de l'accueil qui défilent jusqu'à leur valeur ;
  - le vinyle de l'accueil tourne lentement en continu.
- Lenis pour un défilement doux, synchronisé avec ScrollTrigger.
- Réinitialise proprement GSAP et Lenis à chaque navigation (`astro:page-load`) et nettoie-les avant de quitter une page, pour éviter les doublons avec les transitions.
- Tout reste élégant et sobre : pas d'effet sur chaque élément, pas de rebond.
- Si l'utilisateur préfère réduire les animations (`prefers-reduced-motion`), désactive les animations GSAP, Lenis et la rotation du vinyle (`gsap.matchMedia`) : le contenu s'affiche directement.
- Le contenu doit rester visible si le JavaScript ne charge pas : n'utilise pas de CSS qui masque le texte par défaut.

## 8. Images

Utilise uniquement les photos de `maquette/photos/`, copiées dans `src/assets/photos/`, avec le composant `<Image>` d'`astro:assets` (formats modernes, tailles adaptées). Garde les textes alternatifs de la maquette. Les bannières sont chargées en priorité, les autres en différé.

## 9. Formulaire de contact

Formulaire Netlify Forms (`data-netlify="true"`, champ anti-spam caché), avec redirection vers `/merci`. Validation des champs obligatoires (marqués *) côté navigateur, avec des messages d'erreur clairs sous chaque champ. Le type d'événement peut être présélectionné via l'URL (utilisé par les pop-up).

## 10. SEO, accessibilité, performance

- Titre et description uniques par page, balises Open Graph, `lang="fr"`, URL canoniques, sitemap via `@astrojs/sitemap`, `robots.txt`.
- Données structurées schema.org (`LocalBusiness`) avec les coordonnées de `site.json`.
- Sémantique de la maquette conservée (titres hiérarchisés, `nav`, `figure` / `blockquote`, `details` pour la FAQ, labels du formulaire). Focus clavier visible. Contrastes conformes.
- Responsive : les grilles passent en une colonne sur mobile, les pop-up deviennent plein écran et défilent.
- `netlify.toml` avec la commande de build et le dossier de sortie.

## 11. Contenu encore manquant

Laisse les textes entre crochets `[… à confirmer]` tels quels pour que je les repère, et liste-les-moi à la fin.

## 12. Méthode

Code page par page en commençant par l'Accueil. Après chaque page, lance `npm run build` (il doit passer sans erreur), puis compare ton rendu avec le fichier correspondant de la maquette et corrige les écarts avant de passer à la suivante.
